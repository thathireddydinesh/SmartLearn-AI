

# ============================================================
# SMARTLEARN AI - COMPLETE PYTHON BACKEND
# React + FastAPI + Firebase Firestore
# ============================================================

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import re
import random
import os
import shutil
import subprocess
import tempfile
import uuid

from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth


app = FastAPI(title="SmartLearn AI Backend")


# ============================================================
# FIREBASE ADMIN CONFIGURATION
# ============================================================

# Load the .env file located beside main.py.
# Uvicorn's --env-file also loads it, but this makes direct imports consistent.
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

FIREBASE_READY = False
db = None
FIREBASE_PROJECT_ID = os.getenv(
    "FIREBASE_PROJECT_ID", "smartlearn-ai-b5fba"
).strip()

try:
    service_account_path = os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS",
        "./firebase-service-account.json"
    ).strip()

    service_account_file = Path(service_account_path)
    if not service_account_file.is_absolute():
        service_account_file = (
            Path(__file__).resolve().parent / service_account_file
        )

    if service_account_file.is_file():
        firebase_credential = credentials.Certificate(
            str(service_account_file)
        )

        credential_project = (
            getattr(firebase_credential, "project_id", None) or ""
        ).strip()

        if not credential_project:
            raise ValueError(
                "The Firebase service-account file has no project_id."
            )

        # The service-account file is the authoritative project source.
        # If the environment value differs, log it and use the credential's
        # project ID instead of preventing Firebase initialization.
        configured_project = FIREBASE_PROJECT_ID
        if configured_project and configured_project != credential_project:
            print(
                "Firebase project setting differs from service-account "
                "project; using service-account project "
                f"'{credential_project}'."
            )

        FIREBASE_PROJECT_ID = credential_project
        app_options = {"projectId": credential_project}

        if firebase_admin._apps:
            firebase_app = firebase_admin.get_app()
            existing_project = getattr(firebase_app, "project_id", None)
            if existing_project and existing_project != credential_project:
                raise ValueError(
                    "An existing Firebase Admin app is initialized for a "
                    "different project. Restart the backend process."
                )
        else:
            firebase_app = firebase_admin.initialize_app(
                firebase_credential,
                app_options
            )

    else:
        raise FileNotFoundError(
            "Firebase service-account file not found: "
            f"{service_account_file}"
        )

    db = firestore.client(app=firebase_app)
    FIREBASE_READY = True
    print(
        "Firebase Admin connected successfully "
        f"(project: {FIREBASE_PROJECT_ID})"
    )

except Exception as error:
    db = None
    FIREBASE_READY = False
    print(
        "Firebase Admin initialization failed: "
        f"{type(error).__name__}: {error}"
    )


# ============================================================
# CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# QUIZ REQUEST MODEL
# ============================================================

class QuizRequest(BaseModel):

    topic: str = Field(min_length=1)

    notes: str = Field(min_length=20)

    question_count: int = Field(
        default=5,
        ge=3,
        le=10
    )

    difficulty: str = "Beginner"


# ============================================================
# JAVA PRACTICE REQUEST MODEL
# ============================================================

class JavaRunRequest(BaseModel):

    code: str = Field(
        min_length=1,
        max_length=20000
    )

    input: str = Field(
        default="",
        max_length=5000
    )


# ============================================================
# CERTIFICATE REQUEST MODEL
# ============================================================

class CertificateIssueRequest(BaseModel):

    course_id: str = Field(min_length=1)


class FacultyCreateRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=100)


# ============================================================
# COURSE LESSON DATA
# ============================================================

course_data = [

    # --------------------------------------------------------
    # COURSE 1 - PYTHON PROGRAMMING
    # --------------------------------------------------------

    {
        "id": 1,
        "name": "Python Programming",
        "title": "Python Programming",
        "level": "Beginner",

        "description": (
            "Learn Python from the basics, including variables, "
            "data types, loops, functions and object-oriented programming."
        ),

        "lesson_list": [

            {
                "title": "Introduction to Python",
                "topics": [
                    "What is Python?",
                    "History and features of Python",
                    "Uses of Python",
                    "Advantages of Python"
                ]
            },

            {
                "title": "Installing Python and VS Code",
                "topics": [
                    "Downloading Python",
                    "Installing Python",
                    "Installing VS Code",
                    "Running your first Python program"
                ]
            },

            {
                "title": "Variables and Data Types",
                "topics": [
                    "What are variables?",
                    "Variable naming rules",
                    "Integer, float and string",
                    "Boolean data type",
                    "Type conversion"
                ]
            },

            {
                "title": "Operators",
                "topics": [
                    "Arithmetic operators",
                    "Comparison operators",
                    "Logical operators",
                    "Assignment operators",
                    "Operator precedence"
                ]
            },

            {
                "title": "Taking User Input",
                "topics": [
                    "input() function",
                    "Reading user input",
                    "Converting input types",
                    "Displaying output using print()"
                ]
            },

            {
                "title": "Conditional Statements",
                "topics": [
                    "if statement",
                    "if-else statement",
                    "if-elif-else statement",
                    "Nested if statements",
                    "Practical programs"
                ]
            },

            {
                "title": "For and While Loops",
                "topics": [
                    "Introduction to loops",
                    "for loop",
                    "while loop",
                    "break and continue",
                    "Nested loops"
                ]
            },

            {
                "title": "Functions",
                "topics": [
                    "Defining functions",
                    "Calling functions",
                    "Parameters and arguments",
                    "Return statement",
                    "Types of functions"
                ]
            },

            {
                "title": "Lists and Tuples",
                "topics": [
                    "Creating lists",
                    "Accessing list elements",
                    "List methods",
                    "Creating tuples",
                    "Difference between lists and tuples"
                ]
            },

            {
                "title": "Dictionaries and Sets",
                "topics": [
                    "Creating dictionaries",
                    "Keys and values",
                    "Dictionary methods",
                    "Creating sets",
                    "Set operations"
                ]
            },

            {
                "title": "Classes and Objects",
                "topics": [
                    "Introduction to OOP",
                    "Creating classes",
                    "Creating objects",
                    "Attributes and methods",
                    "Constructors"
                ]
            },

            {
                "title": "Python Mini Project",
                "topics": [
                    "Project planning",
                    "Writing Python code",
                    "Using functions and conditions",
                    "Testing the program",
                    "Improving the project"
                ]
            }

        ]
    },


    # --------------------------------------------------------
    # COURSE 2 - JAVA PROGRAMMING
    # --------------------------------------------------------

    {
        "id": 2,
        "name": "Java Programming",
        "title": "Java Programming",
        "level": "Intermediate",

        "description": (
            "Understand Java programming, object-oriented concepts, "
            "arrays, methods, exception handling and collections."
        ),

        "lesson_list": [

            {
                "title": "Introduction to Java",
                "topics": [
                    "What is Java?",
                    "Features of Java",
                    "Java applications",
                    "JVM, JRE and JDK"
                ]
            },

            {
                "title": "Java Installation and Setup",
                "topics": [
                    "Installing JDK",
                    "Setting up Java",
                    "Installing VS Code",
                    "Writing your first Java program"
                ]
            },

            {
                "title": "Variables and Data Types",
                "topics": [
                    "Variable declaration",
                    "Primitive data types",
                    "Non-primitive data types",
                    "Type casting",
                    "Variable naming rules"
                ]
            },

            {
                "title": "Operators",
                "topics": [
                    "Arithmetic operators",
                    "Relational operators",
                    "Logical operators",
                    "Assignment operators",
                    "Unary operators"
                ]
            },

            {
                "title": "Scanner Class",
                "topics": [
                    "Importing Scanner",
                    "Creating Scanner objects",
                    "nextInt() and nextDouble()",
                    "next() and nextLine()",
                    "Taking user input"
                ]
            },

            {
                "title": "If and Else Statements",
                "topics": [
                    "if statement",
                    "if-else statement",
                    "else-if ladder",
                    "Nested if",
                    "Switch statement"
                ]
            },

            {
                "title": "Loops",
                "topics": [
                    "for loop",
                    "while loop",
                    "do-while loop",
                    "break statement",
                    "continue statement"
                ]
            },

            {
                "title": "Methods",
                "topics": [
                    "Method declaration",
                    "Method calling",
                    "Parameters and arguments",
                    "Return types",
                    "Method overloading"
                ]
            },

            {
                "title": "Arrays",
                "topics": [
                    "Array declaration",
                    "Array initialization",
                    "One-dimensional arrays",
                    "Two-dimensional arrays",
                    "Array traversal"
                ]
            },

            {
                "title": "Classes and Objects",
                "topics": [
                    "Class definition",
                    "Object creation",
                    "Instance variables",
                    "Instance methods",
                    "Accessing class members"
                ]
            },

            {
                "title": "Constructors",
                "topics": [
                    "What is a constructor?",
                    "Default constructor",
                    "Parameterized constructor",
                    "Constructor overloading",
                    "Constructor execution"
                ]
            },

            {
                "title": "Inheritance",
                "topics": [
                    "What is inheritance?",
                    "Single inheritance",
                    "Multilevel inheritance",
                    "Hierarchical inheritance",
                    "Method overriding"
                ]
            },

            {
                "title": "Polymorphism",
                "topics": [
                    "Compile-time polymorphism",
                    "Runtime polymorphism",
                    "Method overloading",
                    "Method overriding",
                    "Dynamic method dispatch"
                ]
            },

            {
                "title": "Exception Handling",
                "topics": [
                    "What is an exception?",
                    "try and catch",
                    "finally block",
                    "throw and throws",
                    "Common Java exceptions"
                ]
            },

            {
                "title": "Java Mini Project",
                "topics": [
                    "Project requirements",
                    "Class and object design",
                    "Writing Java methods",
                    "Testing the application",
                    "Project improvements"
                ]
            }

        ]
    },


    # --------------------------------------------------------
    # COURSE 3 - WEB DEVELOPMENT
    # --------------------------------------------------------

    {
        "id": 3,
        "name": "Web Development",
        "title": "Web Development",
        "level": "Beginner",

        "description": (
            "Build websites using HTML, CSS and JavaScript. "
            "Learn page structure, styling, responsive layouts "
            "and interactive features."
        ),

        "lesson_list": [

            {
                "title": "Introduction to Web Development",
                "topics": [
                    "What is web development?",
                    "Frontend and backend",
                    "Static and dynamic websites",
                    "Web development tools"
                ]
            },

            {
                "title": "How Websites Work",
                "topics": [
                    "How browsers work",
                    "Web servers",
                    "HTTP and HTTPS",
                    "Domain names and hosting"
                ]
            },

            {
                "title": "HTML Basics",
                "topics": [
                    "What is HTML?",
                    "HTML document structure",
                    "HTML tags",
                    "Headings and paragraphs"
                ]
            },

            {
                "title": "HTML Elements and Attributes",
                "topics": [
                    "HTML elements",
                    "HTML attributes",
                    "Links and images",
                    "Lists and tables"
                ]
            },

            {
                "title": "Forms in HTML",
                "topics": [
                    "Form element",
                    "Input fields",
                    "Labels and buttons",
                    "Select and textarea",
                    "Form validation"
                ]
            },

            {
                "title": "CSS Introduction",
                "topics": [
                    "What is CSS?",
                    "Inline CSS",
                    "Internal CSS",
                    "External CSS",
                    "Connecting CSS to HTML"
                ]
            },

            {
                "title": "CSS Selectors",
                "topics": [
                    "Element selectors",
                    "Class selectors",
                    "ID selectors",
                    "Universal selector",
                    "Grouping selectors"
                ]
            },

            {
                "title": "Colors and Typography",
                "topics": [
                    "CSS colors",
                    "Background colors",
                    "Font families",
                    "Font sizes",
                    "Text alignment"
                ]
            },

            {
                "title": "CSS Box Model",
                "topics": [
                    "Content",
                    "Padding",
                    "Border",
                    "Margin",
                    "Box sizing"
                ]
            },

            {
                "title": "Flexbox",
                "topics": [
                    "Flex containers",
                    "Flex direction",
                    "Justify content",
                    "Align items",
                    "Flex wrapping"
                ]
            },

            {
                "title": "CSS Grid",
                "topics": [
                    "Grid containers",
                    "Grid columns and rows",
                    "Grid gaps",
                    "Grid item placement",
                    "Responsive grids"
                ]
            },

            {
                "title": "Responsive Design",
                "topics": [
                    "Responsive websites",
                    "Media queries",
                    "Mobile-first design",
                    "Flexible layouts",
                    "Viewport settings"
                ]
            },

            {
                "title": "JavaScript Introduction",
                "topics": [
                    "What is JavaScript?",
                    "JavaScript in browsers",
                    "Adding JavaScript to HTML",
                    "Basic syntax"
                ]
            },

            {
                "title": "Variables and Data Types",
                "topics": [
                    "var, let and const",
                    "String data type",
                    "Number data type",
                    "Boolean data type",
                    "Type conversion"
                ]
            },

            {
                "title": "Functions",
                "topics": [
                    "Function declaration",
                    "Function expressions",
                    "Parameters and arguments",
                    "Return values",
                    "Arrow functions"
                ]
            },

            {
                "title": "DOM Manipulation",
                "topics": [
                    "What is the DOM?",
                    "Selecting HTML elements",
                    "Changing text and styles",
                    "Creating elements",
                    "Removing elements"
                ]
            },

            {
                "title": "Events in JavaScript",
                "topics": [
                    "Click events",
                    "Input events",
                    "Submit events",
                    "Event listeners",
                    "Event handling"
                ]
            },

            {
                "title": "Website Mini Project",
                "topics": [
                    "Planning website pages",
                    "Building HTML structure",
                    "Applying CSS styling",
                    "Adding JavaScript interactions",
                    "Testing the website"
                ]
            }

        ]
    },


    # --------------------------------------------------------
    # COURSE 4 - DATA STRUCTURES
    # --------------------------------------------------------

    {
        "id": 4,
        "name": "Data Structures",
        "title": "Data Structures",
        "level": "Intermediate",

        "description": (
            "Learn how to organize, store and manage data efficiently "
            "using important data structures and algorithms."
        ),

        "lesson_list": [

            {
                "title": "Introduction to Data Structures",
                "topics": [
                    "What are data structures?",
                    "Types of data structures",
                    "Linear and non-linear structures",
                    "Applications of data structures"
                ]
            },

            {
                "title": "Arrays",
                "topics": [
                    "Array representation",
                    "Array operations",
                    "Insertion and deletion",
                    "Array traversal",
                    "Advantages and limitations"
                ]
            },

            {
                "title": "Linked Lists",
                "topics": [
                    "Introduction to linked lists",
                    "Nodes and pointers",
                    "Singly linked lists",
                    "Doubly linked lists",
                    "Insertion and deletion"
                ]
            },

            {
                "title": "Stacks",
                "topics": [
                    "Stack introduction",
                    "LIFO principle",
                    "Push operation",
                    "Pop operation",
                    "Stack applications"
                ]
            },

            {
                "title": "Queues",
                "topics": [
                    "Queue introduction",
                    "FIFO principle",
                    "Enqueue operation",
                    "Dequeue operation",
                    "Circular queues"
                ]
            },

            {
                "title": "Searching Algorithms",
                "topics": [
                    "Introduction to searching",
                    "Searching techniques",
                    "Search efficiency",
                    "Time complexity",
                    "Algorithm comparison"
                ]
            },

            {
                "title": "Linear Search",
                "topics": [
                    "Linear search concept",
                    "Step-by-step searching",
                    "Linear search algorithm",
                    "Time complexity",
                    "Practical examples"
                ]
            },

            {
                "title": "Binary Search",
                "topics": [
                    "Binary search concept",
                    "Sorted arrays",
                    "Divide and conquer",
                    "Binary search algorithm",
                    "Time complexity"
                ]
            },

            {
                "title": "Sorting Algorithms",
                "topics": [
                    "Introduction to sorting",
                    "Comparison-based sorting",
                    "Sorting stability",
                    "Time complexity",
                    "Sorting applications"
                ]
            },

            {
                "title": "Bubble Sort",
                "topics": [
                    "Bubble sort concept",
                    "Adjacent element comparison",
                    "Swapping elements",
                    "Bubble sort algorithm",
                    "Time complexity"
                ]
            },

            {
                "title": "Selection Sort",
                "topics": [
                    "Selection sort concept",
                    "Finding minimum elements",
                    "Swapping elements",
                    "Selection sort algorithm",
                    "Time complexity"
                ]
            },

            {
                "title": "Trees",
                "topics": [
                    "Tree terminology",
                    "Root and child nodes",
                    "Binary trees",
                    "Tree traversal",
                    "Binary search trees"
                ]
            },

            {
                "title": "Graphs",
                "topics": [
                    "Graph terminology",
                    "Vertices and edges",
                    "Directed and undirected graphs",
                    "Graph representation",
                    "Graph traversal"
                ]
            },

            {
                "title": "Hashing",
                "topics": [
                    "Introduction to hashing",
                    "Hash functions",
                    "Hash tables",
                    "Collision handling",
                    "Applications of hashing"
                ]
            }

        ]
    },


    # --------------------------------------------------------
    # COURSE 5 - ARTIFICIAL INTELLIGENCE
    # --------------------------------------------------------

    {
        "id": 5,
        "name": "Artificial Intelligence",
        "title": "Artificial Intelligence",
        "level": "Advanced",

        "description": (
            "Explore artificial intelligence fundamentals, "
            "machine learning, neural networks and real-world AI applications."
        ),

        "lesson_list": [

            {
                "title": "Introduction to AI",
                "topics": [
                    "What is artificial intelligence?",
                    "Goals of AI",
                    "Characteristics of AI",
                    "Applications of AI"
                ]
            },

            {
                "title": "History of AI",
                "topics": [
                    "Early development of AI",
                    "Important AI milestones",
                    "AI development stages",
                    "Modern AI systems"
                ]
            },

            {
                "title": "Applications of AI",
                "topics": [
                    "AI in healthcare",
                    "AI in education",
                    "AI in transportation",
                    "AI in business",
                    "Everyday AI applications"
                ]
            },

            {
                "title": "Types of AI",
                "topics": [
                    "Narrow AI",
                    "General AI",
                    "Superintelligent AI",
                    "Capabilities of AI systems"
                ]
            },

            {
                "title": "Introduction to Machine Learning",
                "topics": [
                    "What is machine learning?",
                    "Machine learning workflow",
                    "Features and labels",
                    "Training a model"
                ]
            },

            {
                "title": "Supervised Learning",
                "topics": [
                    "Supervised learning concept",
                    "Labeled datasets",
                    "Classification problems",
                    "Regression problems",
                    "Practical examples"
                ]
            },

            {
                "title": "Unsupervised Learning",
                "topics": [
                    "Unsupervised learning concept",
                    "Unlabeled datasets",
                    "Clustering",
                    "Association",
                    "Practical examples"
                ]
            },

            {
                "title": "Reinforcement Learning",
                "topics": [
                    "Agent and environment",
                    "Actions and rewards",
                    "Learning through feedback",
                    "Exploration and exploitation"
                ]
            },

            {
                "title": "Data Preparation",
                "topics": [
                    "Collecting datasets",
                    "Data cleaning",
                    "Handling missing values",
                    "Data transformation",
                    "Feature preparation"
                ]
            },

            {
                "title": "Training Data",
                "topics": [
                    "Training dataset",
                    "Features and labels",
                    "Data quality",
                    "Training and validation split"
                ]
            },

            {
                "title": "Testing Data",
                "topics": [
                    "Testing dataset",
                    "Model evaluation",
                    "Prediction accuracy",
                    "Overfitting and underfitting"
                ]
            },

            {
                "title": "Regression",
                "topics": [
                    "Regression concept",
                    "Linear regression",
                    "Independent and dependent variables",
                    "Prediction",
                    "Regression evaluation"
                ]
            },

            {
                "title": "Classification",
                "topics": [
                    "Classification concept",
                    "Binary classification",
                    "Multiclass classification",
                    "Classification algorithms",
                    "Confusion matrix"
                ]
            },

            {
                "title": "Clustering",
                "topics": [
                    "Clustering concept",
                    "K-means clustering",
                    "Grouping similar data",
                    "Cluster evaluation"
                ]
            },

            {
                "title": "Neural Networks",
                "topics": [
                    "Artificial neurons",
                    "Input and output layers",
                    "Hidden layers",
                    "Weights and biases",
                    "Activation functions"
                ]
            },

            {
                "title": "Deep Learning",
                "topics": [
                    "Deep learning concept",
                    "Deep neural networks",
                    "Training deep models",
                    "Applications of deep learning"
                ]
            },

            {
                "title": "Natural Language Processing",
                "topics": [
                    "What is NLP?",
                    "Text processing",
                    "Tokenization",
                    "Sentiment analysis",
                    "Chatbots"
                ]
            },

            {
                "title": "Computer Vision",
                "topics": [
                    "What is computer vision?",
                    "Image processing",
                    "Image classification",
                    "Object detection",
                    "Computer vision applications"
                ]
            },

            {
                "title": "AI Ethics",
                "topics": [
                    "Responsible AI",
                    "AI fairness",
                    "Privacy and security",
                    "Bias in AI",
                    "Human oversight"
                ]
            },

            {
                "title": "AI Mini Project",
                "topics": [
                    "Selecting an AI problem",
                    "Collecting data",
                    "Preparing a dataset",
                    "Building and testing a model",
                    "Presenting project results"
                ]
            }

        ]
    },


    # --------------------------------------------------------
    # COURSE 6 - DATABASE MANAGEMENT
    # --------------------------------------------------------

    {
        "id": 6,
        "name": "Database Management",
        "title": "Database Management",
        "level": "Beginner",

        "description": (
            "Understand databases, SQL queries, tables, relationships "
            "and database management fundamentals."
        ),

        "lesson_list": [

            {
                "title": "Introduction to Databases",
                "topics": [
                    "What is a database?",
                    "Purpose of databases",
                    "Types of databases",
                    "Real-world database examples"
                ]
            },

            {
                "title": "Database Management Systems",
                "topics": [
                    "What is a DBMS?",
                    "Functions of a DBMS",
                    "Advantages of DBMS",
                    "Examples of DBMS software"
                ]
            },

            {
                "title": "Relational Databases",
                "topics": [
                    "Relational database concept",
                    "Rows and columns",
                    "Database relationships",
                    "Relational database examples"
                ]
            },

            {
                "title": "Tables and Records",
                "topics": [
                    "Creating database tables",
                    "Rows and records",
                    "Columns and fields",
                    "Data types",
                    "Table structure"
                ]
            },

            {
                "title": "Introduction to SQL",
                "topics": [
                    "What is SQL?",
                    "SQL commands",
                    "DDL commands",
                    "DML commands",
                    "Writing basic SQL queries"
                ]
            },

            {
                "title": "SELECT Queries",
                "topics": [
                    "SELECT statement",
                    "Selecting specific columns",
                    "WHERE condition",
                    "ORDER BY clause",
                    "DISTINCT keyword"
                ]
            },

            {
                "title": "INSERT, UPDATE and DELETE",
                "topics": [
                    "INSERT statement",
                    "UPDATE statement",
                    "DELETE statement",
                    "Using WHERE conditions",
                    "Practical SQL examples"
                ]
            },

            {
                "title": "Primary and Foreign Keys",
                "topics": [
                    "Primary key",
                    "Foreign key",
                    "Candidate keys",
                    "Referential integrity",
                    "Table relationships"
                ]
            },

            {
                "title": "Joins",
                "topics": [
                    "Introduction to joins",
                    "INNER JOIN",
                    "LEFT JOIN",
                    "RIGHT JOIN",
                    "Joining multiple tables"
                ]
            },

            {
                "title": "Database Mini Project",
                "topics": [
                    "Planning database tables",
                    "Creating a database",
                    "Inserting records",
                    "Writing SQL queries",
                    "Testing the database"
                ]
            }

        ]
    }

]


# ============================================================
# PREPARE COURSE DATA FOR API
# ============================================================

courses = []

for course in course_data:

    course["lessons"] = len(course["lesson_list"])

    courses.append(course)


# ============================================================
# HOME ROUTE
# ============================================================

@app.get("/")
def home():

    return {
        "message": "SmartLearn AI Backend is running!",
        "courses": len(courses)
    }


# ============================================================
# HEALTH CHECK
# ============================================================

def _health_payload():
    ai_key_present = bool(os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY"))
    return {
        "status": "healthy",
        "firebase": "connected" if FIREBASE_READY else "not connected",
        "firebase_admin": FIREBASE_READY,
        "firebase_project_id": FIREBASE_PROJECT_ID,
        "ai_mode": "external-provider" if ai_key_present else "not-configured",
        "ai_configured": ai_key_present,
        "ai_provider": os.getenv("AI_PROVIDER", "openai-compatible"),
    }


@app.get("/health")
def health_check():
    return _health_payload()


@app.get("/api/health")
def health():
    # Keep the existing health route for older frontend versions.
    return _health_payload()


# ============================================================
# JAVA PRACTICE RUNNER
# LOCAL DEVELOPMENT ONLY
# ============================================================

@app.post("/api/java/run")
def run_java(request: JavaRunRequest):

    java_path = shutil.which("java")

    javac_path = shutil.which("javac")

    if not java_path or not javac_path:

        raise HTTPException(
            status_code=503,
            detail=(
                "Java JDK not found. Install a JDK, "
                "then restart the backend terminal."
            )
        )

    with tempfile.TemporaryDirectory(
        prefix="smartlearn_java_"
    ) as temp_dir:

        source_file = Path(temp_dir) / "Main.java"

        source_file.write_text(
            request.code,
            encoding="utf-8"
        )

        try:

            compile_result = subprocess.run(
                [
                    javac_path,
                    "-encoding",
                    "UTF-8",
                    str(source_file)
                ],
                cwd=temp_dir,
                capture_output=True,
                text=True,
                timeout=10,
                check=False
            )

        except subprocess.TimeoutExpired:

            return {
                "success": False,
                "stage": "compile",
                "output": "Compilation timed out (10 seconds)."
            }

        if compile_result.returncode != 0:

            error_text = (
                compile_result.stderr
                or compile_result.stdout
                or "Compilation failed."
            )

            return {
                "success": False,
                "stage": "compile",
                "output": error_text[-12000:]
            }

        try:

            run_result = subprocess.run(
                [
                    java_path,
                    "-Dfile.encoding=UTF-8",
                    "-cp",
                    temp_dir,
                    "Main"
                ],
                cwd=temp_dir,
                input=request.input,
                capture_output=True,
                text=True,
                timeout=5,
                check=False
            )

        except subprocess.TimeoutExpired:

            return {
                "success": False,
                "stage": "run",
                "output": (
                    "Program stopped because it exceeded "
                    "the 5-second time limit."
                )
            }

        output_text = run_result.stdout or ""

        if run_result.stderr:

            output_text += (
                "\n" if output_text else ""
            ) + run_result.stderr

        if run_result.returncode != 0:

            return {
                "success": False,
                "stage": "run",
                "output": (
                    output_text
                    or (
                        "Program exited with code "
                        f"{run_result.returncode}."
                    )
                )[-12000:]
            }

        return {
            "success": True,
            "stage": "complete",
            "output": (
                output_text
                or "Program ran successfully (no output)."
            )
        }


# ============================================================
# GET ALL COURSES
# ============================================================

@app.get("/api/courses")
def get_courses():

    return courses


# ============================================================
# GET INDIVIDUAL COURSE
# ============================================================

@app.get("/api/courses/{course_id}")
def get_course(course_id: int):

    course = next(
        (
            item for item in courses
            if item["id"] == course_id
        ),
        None
    )

    if course is None:

        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    return course


# ============================================================
# GET INDIVIDUAL LESSON WITH TOPICS
# ============================================================

@app.get(
    "/api/courses/{course_id}/lessons/{lesson_number}"
)
def get_lesson(course_id: int, lesson_number: int):

    course = next(
        (
            item for item in courses
            if item["id"] == course_id
        ),
        None
    )

    if course is None:

        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )

    lesson_list = course["lesson_list"]

    if lesson_number < 1 or lesson_number > len(lesson_list):

        raise HTTPException(
            status_code=404,
            detail="Lesson not found"
        )

    lesson = lesson_list[lesson_number - 1]

    topics = lesson["topics"]

    content = (
        f"Welcome to {lesson['title']}.\n\n"
        f"In this lesson, you will learn about "
        f"{lesson['title']} as part of {course['name']}.\n\n"
        "Study each topic carefully and practise "
        "the concepts using examples."
    )

    return {
        "course_id": course_id,
        "course_name": course["name"],
        "lesson_number": lesson_number,
        "title": lesson["title"],
        "description": (
            f"Learn {lesson['title']} in {course['name']}."
        ),
        "topics": topics,
        "content": content,
        "completed": False
    }


# ============================================================
# CREATE QUIZ QUESTIONS
# ============================================================

def create_questions(
    topic,
    notes,
    count,
    difficulty
):

    sentences = re.split(
        r'(?<=[.!?])\s+',
        notes.strip()
    )

    words = re.findall(
        r'\b[A-Za-z][A-Za-z-]{3,}\b',
        notes
    )

    stop_words = {
        "this", "that", "with", "from", "have", "which",
        "their", "there", "about", "these", "those", "will",
        "your", "when", "where", "what", "because", "into",
        "also", "than", "then", "them", "they", "been",
        "being", "using", "used", "each", "such", "some"
    }

    useful_words = list(dict.fromkeys(
        word for word in words
        if word.lower() not in stop_words
    ))

    if len(useful_words) < 4:

        raise HTTPException(
            status_code=400,
            detail="Please provide more detailed study notes."
        )

    questions = []

    used_words = set()

    for sentence in sentences:

        sentence_words = re.findall(
            r'\b[A-Za-z][A-Za-z-]{3,}\b',
            sentence
        )

        candidates = [
            word for word in sentence_words
            if word.lower() not in stop_words
            and word.lower() not in used_words
        ]

        if not candidates:
            continue

        answer = max(
            candidates,
            key=len
        )

        question_text = re.sub(
            r'\b' + re.escape(answer) + r'\b',
            "________",
            sentence,
            count=1,
            flags=re.IGNORECASE
        )

        distractors = [
            word for word in useful_words
            if word.lower() != answer.lower()
            and word.lower() not in used_words
        ]

        distractors = list(dict.fromkeys(distractors))

        if len(distractors) < 3:
            continue

        options = (
            random.sample(distractors, 3)
            + [answer]
        )

        random.shuffle(options)

        questions.append({

            "question": f"{topic}: {question_text}",

            "options": options,

            "answer": options.index(answer),

            "explanation": (
                f"The correct answer is {answer}. "
                "This word appears in your supplied study notes."
            )

        })

        used_words.add(answer.lower())

        if len(questions) >= count:
            break

    if len(questions) < 3:

        raise HTTPException(
            status_code=400,
            detail=(
                "Not enough suitable sentences were found. "
                "Please add more detailed notes with at least "
                "three clear sentences."
            )
        )

    return questions


# ============================================================
# GENERATE QUIZ
# ============================================================

@app.post("/api/generate-quiz")
def generate_quiz(request: QuizRequest):

    try:

        questions = create_questions(
            topic=request.topic,
            notes=request.notes,
            count=request.question_count,
            difficulty=request.difficulty
        )

        return {
            "title": f"{request.topic} Quiz",
            "topic": request.topic,
            "difficulty": request.difficulty,
            "questions": questions,
            "mode": "local-rule-based"
        }

    except HTTPException:

        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail="Quiz generation failed. Please try again."
        ) from error


# ============================================================
# FIREBASE AUTHENTICATION HELPER
# ============================================================

def get_authenticated_user(authorization: str = None):
    if not FIREBASE_READY or db is None:
        raise HTTPException(status_code=503, detail="Firebase Admin is not initialized. Check backend startup logs.")

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Firebase authentication token is required in the Bearer header.")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token is missing.")

    try:
        # Firebase Admin verifies signature, issuer, audience, and expiry against
        # the configured Firebase project. Do not log or return the token.
        decoded_token = firebase_auth.verify_id_token(token, app=firebase_admin.get_app())
        if decoded_token.get("aud") != FIREBASE_PROJECT_ID:
            raise ValueError("Token audience does not match configured Firebase project.")
        return decoded_token
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase ID token has expired. Sign out and sign in again.")
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase ID token has been revoked. Sign in again.")
    except firebase_auth.InvalidIdTokenError as error:
        print(f"Firebase ID token rejected: {type(error).__name__}: {error}")
        raise HTTPException(status_code=401, detail="Firebase rejected the ID token. Check that frontend and backend use the same Firebase project and that the user signed in again.")
    except Exception as error:
        print(f"Firebase token verification failed: {type(error).__name__}: {error}")
        raise HTTPException(status_code=401, detail="Firebase token verification failed. Check backend console logs for the diagnostic error.")


# ============================================================
# ADMIN: CREATE FACULTY ACCOUNT
# ============================================================

@app.post("/api/admin/faculty", status_code=201)
def create_faculty_account(
    request: FacultyCreateRequest,
    authorization: str = Header(default=None)
):
    # Authenticate the caller and confirm their Firestore role server-side.
    admin_user = get_authenticated_user(authorization)
    admin_uid = admin_user.get("uid")
    if not admin_uid:
        raise HTTPException(status_code=401, detail="Authenticated user ID is missing.")

    admin_profile = db.collection("users").document(admin_uid).get()
    if not admin_profile.exists:
        raise HTTPException(status_code=403, detail="Admin profile was not found.")

    admin_data = admin_profile.to_dict() or {}
    if str(admin_data.get("role", "")).strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Only an admin can create faculty accounts.")

    email = request.email.strip().lower()
    display_name = request.display_name.strip()
    password = request.password

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid faculty email address.")
    if len(display_name) < 2:
        raise HTTPException(status_code=422, detail="Enter the faculty member's name.")

    faculty_record = None
    try:
        faculty_record = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
            email_verified=False,
            disabled=False,
            app=firebase_admin.get_app()
        )

        profile_ref = db.collection("users").document(faculty_record.uid)
        if profile_ref.get().exists:
            firebase_auth.delete_user(faculty_record.uid, app=firebase_admin.get_app())
            raise HTTPException(
                status_code=409,
                detail="A user profile already exists for this account. Contact the project administrator."
            )

        profile_ref.set({
            "uid": faculty_record.uid,
            "name": display_name,
            "displayName": display_name,
            "email": email,
            "role": "faculty",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "createdBy": admin_uid
        })

        return {
            "success": True,
            "message": "Faculty account created successfully.",
            "faculty": {
                "uid": faculty_record.uid,
                "name": display_name,
                "email": email,
                "role": "faculty"
            }
        }

    except HTTPException:
        raise
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    except Exception as error:
        # If profile creation fails after Auth creation, remove the orphaned Auth account.
        if faculty_record is not None:
            try:
                firebase_auth.delete_user(faculty_record.uid, app=firebase_admin.get_app())
            except Exception as cleanup_error:
                print(f"Faculty account rollback failed: {type(cleanup_error).__name__}")
        print(f"Faculty account creation failed: {type(error).__name__}: {error}")
        raise HTTPException(
            status_code=500,
            detail="Could not create the faculty account. Check backend logs and Firebase Admin permissions."
        )


# ============================================================
# ISSUE CERTIFICATE
# ============================================================

@app.post("/api/certificates/issue")
def issue_certificate(
    request: CertificateIssueRequest,
    authorization: str = Header(default=None)
):

    # --------------------------------------------------------
    # 1. Authenticate student
    # --------------------------------------------------------

    user = get_authenticated_user(authorization)

    uid = user["uid"]

    course_id = request.course_id.strip()

    # --------------------------------------------------------
    # 2. Find course in backend course data
    # --------------------------------------------------------

    course = next(
        (
            item for item in courses
            if str(item["id"]) == course_id
        ),
        None
    )

    if course is None:

        raise HTTPException(
            status_code=404,
            detail="Course not found."
        )

    # --------------------------------------------------------
    # 3. Read student's course progress from Firestore
    # --------------------------------------------------------

    progress_ref = (
        db.collection("users")
        .document(uid)
        .collection("courseProgress")
        .document(course_id)
    )

    progress_snapshot = progress_ref.get()

    if not progress_snapshot.exists:

        raise HTTPException(
            status_code=400,
            detail="Course progress not found."
        )

    progress = progress_snapshot.to_dict() or {}

    completed_lessons = progress.get(
        "completedLessons",
        []
    )

    required_lessons = len(
        course["lesson_list"]
    )

    # --------------------------------------------------------
    # 4. Validate all lesson indexes
    # --------------------------------------------------------

    if not isinstance(completed_lessons, list):

        raise HTTPException(
            status_code=400,
            detail="Invalid course progress data."
        )

    try:

        completed_indexes = {
            int(index)
            for index in completed_lessons
        }

    except (TypeError, ValueError):

        raise HTTPException(
            status_code=400,
            detail="Invalid course progress data."
        )

    valid_indexes = set(
        range(required_lessons)
    )

    if not valid_indexes.issubset(completed_indexes):

        raise HTTPException(
            status_code=400,
            detail=(
                "Complete all course lessons "
                "before requesting a certificate."
            )
        )

    # --------------------------------------------------------
    # 5. Check if certificate already exists
    # --------------------------------------------------------

    private_ref = (
        db.collection("users")
        .document(uid)
        .collection("certificates")
        .document(course_id)
    )

    existing = private_ref.get()

    if existing.exists:

        existing_certificate = existing.to_dict() or {}

        return {
            "success": True,
            "message": "Certificate already exists.",
            "certificate": existing_certificate
        }

    # --------------------------------------------------------
    # 6. Get student name from Firebase Authentication
    # --------------------------------------------------------

    try:

        firebase_user = firebase_auth.get_user(uid)

        student_name = (
            firebase_user.display_name
            or user.get("name")
            or "Student"
        )

    except Exception:

        student_name = (
            user.get("name")
            or "Student"
        )

    # --------------------------------------------------------
    # 7. Generate unique certificate ID
    # --------------------------------------------------------

    certificate_id = (
        "SLAI-" + uuid.uuid4().hex.upper()
    )

    completion_date = datetime.now(
        timezone.utc
    ).strftime("%Y-%m-%d")

    # --------------------------------------------------------
    # 8. Prepare certificate information
    # --------------------------------------------------------

    certificate = {

        "certificateId": certificate_id,

        "courseId": course_id,

        "courseName": course["name"],

        "studentName": student_name,

        "completionDate": completion_date,

        "completedAt": firestore.SERVER_TIMESTAMP,

        "status": "valid"

    }

    # --------------------------------------------------------
    # 9. Save private certificate
    # --------------------------------------------------------

    private_ref.set(certificate)

    # --------------------------------------------------------
    # 10. Save public verification record
    # --------------------------------------------------------

    public_ref = (
        db.collection("publicCertificates")
        .document(certificate_id)
    )

    public_ref.set({

        "certificateId": certificate_id,

        "courseName": course["name"],

        "studentName": student_name,

        "completionDate": completion_date,

        "status": "valid"

    })

    # --------------------------------------------------------
    # 11. Return certificate
    # --------------------------------------------------------

    return {

        "success": True,

        "message": "Certificate issued successfully.",

        "certificate": {

            "certificateId": certificate_id,

            "courseId": course_id,

            "courseName": course["name"],

            "studentName": student_name,

            "completionDate": completion_date,

            "status": "valid"

        }

    }


# ============================================================
# PUBLIC CERTIFICATE VERIFICATION
# ============================================================

@app.get(
    "/api/certificates/verify/{certificate_id}"
)
def verify_certificate(certificate_id: str):

    # --------------------------------------------------------
    # 1. Check Firebase connection
    # --------------------------------------------------------

    if not FIREBASE_READY or db is None:

        raise HTTPException(
            status_code=503,
            detail=(
                "Certificate verification is temporarily unavailable."
            )
        )

    certificate_id = certificate_id.strip()

    # --------------------------------------------------------
    # 2. Validate certificate ID
    # --------------------------------------------------------

    if not certificate_id:

        return {
            "valid": False,
            "message": "Certificate ID is required."
        }

    # --------------------------------------------------------
    # 3. Find certificate in publicCertificates
    # --------------------------------------------------------

    certificate_ref = (
        db.collection("publicCertificates")
        .document(certificate_id)
    )

    certificate_snapshot = certificate_ref.get()

    # --------------------------------------------------------
    # 4. Certificate does not exist
    # --------------------------------------------------------

    if not certificate_snapshot.exists:

        return {

            "valid": False,

            "message": (
                "Invalid certificate. "
                "No matching record was found."
            )

        }

    certificate = (
        certificate_snapshot.to_dict() or {}
    )

    # --------------------------------------------------------
    # 5. Check certificate status
    # --------------------------------------------------------

    if certificate.get("status") != "valid":

        return {

            "valid": False,

            "message": "This certificate is not valid."

        }

    # --------------------------------------------------------
    # 6. Return public certificate information only
    # --------------------------------------------------------

    return {

        "valid": True,

        "certificate": {

            "certificateId": certificate.get(
                "certificateId"
            ),

            "studentName": certificate.get(
                "studentName"
            ),

            "courseName": certificate.get(
                "courseName"
            ),

            "completionDate": certificate.get(
                "completionDate"
            ),

            "status": "valid"

        }

    }



# ============================================================
# WIZIAI SMART TUTOR - AI CHAT ENDPOINT
# ============================================================

from typing import List, Literal, Optional
from urllib.request import Request as URLRequest, urlopen
from urllib.error import HTTPError, URLError
import json
import asyncio


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class TutorChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    course: str = Field(min_length=1, max_length=160)
    history: List[TutorMessage] = Field(default_factory=list, max_length=12)


def _call_tutor_provider(course: str, message: str, history: list):
    """Call an OpenAI-compatible chat-completions provider without exposing keys to React."""
    api_key = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI provider is not configured. Set AI_API_KEY (or OPENAI_API_KEY) in the backend environment."
        )

    base_url = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("AI_MODEL", "gpt-4o-mini")
    endpoint = f"{base_url}/chat/completions"

    messages = [{
        "role": "system",
        "content": (
            "You are WiZiAI, a patient and encouraging academic tutor for SmartLearn AI. "
            f"The student's selected course or subject is: {course}. "
            "Explain concepts step by step, use accurate examples, show code output when useful, "
            "and finish with a short practice question when appropriate. If debugging, explain the cause "
            "and provide corrected code. Do not claim to access private course records or external systems. "
            "If a question is outside the subject, still help safely and clearly."
        )
    }]

    # Keep only valid recent turns and never trust client-supplied system/developer roles.
    for item in history[-12:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content[:6000]})
    messages.append({"role": "user", "content": message})

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.4
    }).encode("utf-8")

    request = URLRequest(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
        answer = result.get("choices", [{}])[0].get("message", {}).get("content")
        if not isinstance(answer, str) or not answer.strip():
            raise HTTPException(status_code=502, detail="The AI provider returned an empty response.")
        return answer.strip()
    except HTTPError as error:
        # Avoid returning provider response bodies, which can contain sensitive diagnostics.
        if error.code in (401, 403):
            raise HTTPException(status_code=502, detail="AI provider authentication failed. Check the backend AI_API_KEY.")
        if error.code == 429:
            raise HTTPException(status_code=503, detail="The AI provider is rate-limiting requests. Please try again shortly.")
        raise HTTPException(status_code=502, detail=f"AI provider request failed (HTTP {error.code}).")
    except (URLError, TimeoutError):
        raise HTTPException(status_code=502, detail="Could not connect to the AI provider. Check backend network access and AI_BASE_URL.")
    except (KeyError, IndexError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="The AI provider returned an invalid response format.")


@app.post("/api/tutor-chat")
async def tutor_chat(
    payload: TutorChatRequest,
    authorization: str = Header(default=None)
):
    # Verify the Firebase ID token on every request.
    user = get_authenticated_user(authorization)
    uid = user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated Firebase user ID is missing.")

    # Keep work off the event loop because urllib is synchronous.
    reply = await asyncio.to_thread(
        _call_tutor_provider,
        payload.course.strip(),
        payload.message.strip(),
        [item.model_dump() for item in payload.history]
    )

    return {"reply": reply}


# ============================================================
# END OF SMARTLEARN AI BACKEND
# ============================================================
