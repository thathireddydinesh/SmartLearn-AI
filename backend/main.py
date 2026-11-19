

# ============================================================
# SMARTLEARN AI - COMPLETE PYTHON BACKEND
# React + FastAPI + Firebase Firestore
# ============================================================

from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form
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
# INTERMEDIATE AND ADVANCED LEARNING PATHS
# 12 additional paths: 6 subjects x 2 levels, 16 lessons each.
# Existing course records (IDs 1-6) are preserved.
# ============================================================

additional_learning_paths = [{'id': 7, 'name': 'Python Programming', 'title': 'Python Programming', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Python Programming, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Advanced Functions and Scope', 'topics': ['Default and keyword arguments', '*args and **kwargs', 'Local and global scope'], 'notes': '## Advanced Functions and Scope\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply advanced functions and scope in practical coursework and projects.\n\n### Learning points\n- Default and keyword arguments\n- *args and **kwargs\n- Local and global scope\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Comprehensions and Iterators', 'topics': ['List and dictionary comprehensions', 'Iterable and iterator', 'Generator expressions'], 'notes': '## Comprehensions and Iterators\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply comprehensions and iterators in practical coursework and projects.\n\n### Learning points\n- List and dictionary comprehensions\n- Iterable and iterator\n- Generator expressions\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Working with Modules and Packages', 'topics': ['Import system', 'Creating reusable modules', 'Package structure'], 'notes': '## Working with Modules and Packages\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply working with modules and packages in practical coursework and projects.\n\n### Learning points\n- Import system\n- Creating reusable modules\n- Package structure\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'File Handling', 'topics': ['Text and binary files', 'Read and write modes', 'with statement and paths'], 'notes': '## File Handling\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply file handling in practical coursework and projects.\n\n### Learning points\n- Text and binary files\n- Read and write modes\n- with statement and paths\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Exception Design', 'topics': ['Custom exceptions', 'Exception chaining', 'Robust error handling'], 'notes': '## Exception Design\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply exception design in practical coursework and projects.\n\n### Learning points\n- Custom exceptions\n- Exception chaining\n- Robust error handling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Object-Oriented Python', 'topics': ['Instance and class attributes', 'Encapsulation', 'Composition'], 'notes': '## Object-Oriented Python\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply object-oriented python in practical coursework and projects.\n\n### Learning points\n- Instance and class attributes\n- Encapsulation\n- Composition\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Inheritance and Polymorphism', 'topics': ['Multiple inheritance', 'Method resolution order', 'Duck typing'], 'notes': '## Inheritance and Polymorphism\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply inheritance and polymorphism in practical coursework and projects.\n\n### Learning points\n- Multiple inheritance\n- Method resolution order\n- Duck typing\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Decorators', 'topics': ['Functions as objects', 'Writing decorators', 'Decorators with arguments'], 'notes': '## Decorators\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply decorators in practical coursework and projects.\n\n### Learning points\n- Functions as objects\n- Writing decorators\n- Decorators with arguments\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Generators and Iteration', 'topics': ['yield keyword', 'Generator functions', 'Memory-efficient iteration'], 'notes': '## Generators and Iteration\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply generators and iteration in practical coursework and projects.\n\n### Learning points\n- yield keyword\n- Generator functions\n- Memory-efficient iteration\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Regular Expressions', 'topics': ['Patterns and character classes', 'Groups and captures', 'Validation with re'], 'notes': '## Regular Expressions\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply regular expressions in practical coursework and projects.\n\n### Learning points\n- Patterns and character classes\n- Groups and captures\n- Validation with re\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Working with JSON and APIs', 'topics': ['JSON encoding and decoding', 'HTTP request concepts', 'Consuming REST APIs'], 'notes': '## Working with JSON and APIs\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply working with json and apis in practical coursework and projects.\n\n### Learning points\n- JSON encoding and decoding\n- HTTP request concepts\n- Consuming REST APIs\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Connectivity', 'topics': ['Relational database concepts', 'CRUD operations', 'Parameterized queries'], 'notes': '## Database Connectivity\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply database connectivity in practical coursework and projects.\n\n### Learning points\n- Relational database concepts\n- CRUD operations\n- Parameterized queries\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Testing and Debugging', 'topics': ['Unit tests', 'Assertions and fixtures', 'Debugging techniques'], 'notes': '## Testing and Debugging\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply testing and debugging in practical coursework and projects.\n\n### Learning points\n- Unit tests\n- Assertions and fixtures\n- Debugging techniques\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Concurrency Basics', 'topics': ['Threads and processes', 'Async and await', 'Choosing a concurrency model'], 'notes': '## Concurrency Basics\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply concurrency basics in practical coursework and projects.\n\n### Learning points\n- Threads and processes\n- Async and await\n- Choosing a concurrency model\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Data Processing Project', 'topics': ['CSV and JSON processing', 'Data validation', 'Build a command-line report tool'], 'notes': '## Data Processing Project\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply data processing project in practical coursework and projects.\n\n### Learning points\n- CSV and JSON processing\n- Data validation\n- Build a command-line report tool\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Intermediate Python Project', 'topics': ['Requirements and design', 'Implementation and testing', 'Documentation and code review'], 'notes': '## Intermediate Python Project\n\nThis intermediate lesson in Python Programming develops the concepts needed to apply intermediate python project in practical coursework and projects.\n\n### Learning points\n- Requirements and design\n- Implementation and testing\n- Documentation and code review\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 8, 'name': 'Python Programming', 'title': 'Python Programming', 'level': 'Advanced', 'description': 'A structured advanced learning path for Python Programming, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Python Internals and Data Model', 'topics': ['Object model and identity', 'Magic methods', 'Mutable and immutable objects'], 'notes': '## Python Internals and Data Model\n\nThis advanced lesson in Python Programming develops the concepts needed to apply python internals and data model in practical coursework and projects.\n\n### Learning points\n- Object model and identity\n- Magic methods\n- Mutable and immutable objects\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Object-Oriented Design', 'topics': ['Abstract base classes', 'Protocols and interfaces', 'SOLID design principles'], 'notes': '## Advanced Object-Oriented Design\n\nThis advanced lesson in Python Programming develops the concepts needed to apply advanced object-oriented design in practical coursework and projects.\n\n### Learning points\n- Abstract base classes\n- Protocols and interfaces\n- SOLID design principles\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Decorators and Metaclasses', 'topics': ['Descriptor protocol', 'Class creation hooks', 'Metaclass use cases'], 'notes': '## Advanced Decorators and Metaclasses\n\nThis advanced lesson in Python Programming develops the concepts needed to apply advanced decorators and metaclasses in practical coursework and projects.\n\n### Learning points\n- Descriptor protocol\n- Class creation hooks\n- Metaclass use cases\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Typing', 'topics': ['Generic types', 'Type variables and protocols', 'Static type checking'], 'notes': '## Advanced Typing\n\nThis advanced lesson in Python Programming develops the concepts needed to apply advanced typing in practical coursework and projects.\n\n### Learning points\n- Generic types\n- Type variables and protocols\n- Static type checking\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Asyncio Architecture', 'topics': ['Event loop', 'Coroutines and tasks', 'Async context managers'], 'notes': '## Asyncio Architecture\n\nThis advanced lesson in Python Programming develops the concepts needed to apply asyncio architecture in practical coursework and projects.\n\n### Learning points\n- Event loop\n- Coroutines and tasks\n- Async context managers\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Parallel Processing', 'topics': ['Multiprocessing pools', 'Process communication', 'CPU-bound and I/O-bound work'], 'notes': '## Parallel Processing\n\nThis advanced lesson in Python Programming develops the concepts needed to apply parallel processing in practical coursework and projects.\n\n### Learning points\n- Multiprocessing pools\n- Process communication\n- CPU-bound and I/O-bound work\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Performance Engineering', 'topics': ['Profiling tools', 'Algorithmic bottlenecks', 'Caching and optimization'], 'notes': '## Performance Engineering\n\nThis advanced lesson in Python Programming develops the concepts needed to apply performance engineering in practical coursework and projects.\n\n### Learning points\n- Profiling tools\n- Algorithmic bottlenecks\n- Caching and optimization\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Memory Management', 'topics': ['Reference counting', 'Garbage collection', 'Memory profiling'], 'notes': '## Memory Management\n\nThis advanced lesson in Python Programming develops the concepts needed to apply memory management in practical coursework and projects.\n\n### Learning points\n- Reference counting\n- Garbage collection\n- Memory profiling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Data Pipelines', 'topics': ['Streaming data', 'Validation pipelines', 'Fault-tolerant processing'], 'notes': '## Advanced Data Pipelines\n\nThis advanced lesson in Python Programming develops the concepts needed to apply advanced data pipelines in practical coursework and projects.\n\n### Learning points\n- Streaming data\n- Validation pipelines\n- Fault-tolerant processing\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Secure Python Development', 'topics': ['Input validation', 'Secrets and configuration', 'Dependency security'], 'notes': '## Secure Python Development\n\nThis advanced lesson in Python Programming develops the concepts needed to apply secure python development in practical coursework and projects.\n\n### Learning points\n- Input validation\n- Secrets and configuration\n- Dependency security\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Scalable API Development', 'topics': ['API design', 'Authentication concepts', 'Pagination and rate limits'], 'notes': '## Scalable API Development\n\nThis advanced lesson in Python Programming develops the concepts needed to apply scalable api development in practical coursework and projects.\n\n### Learning points\n- API design\n- Authentication concepts\n- Pagination and rate limits\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Database Patterns', 'topics': ['Transactions', 'Indexes and query plans', 'Connection pooling'], 'notes': '## Advanced Database Patterns\n\nThis advanced lesson in Python Programming develops the concepts needed to apply advanced database patterns in practical coursework and projects.\n\n### Learning points\n- Transactions\n- Indexes and query plans\n- Connection pooling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Architecture and Design Patterns', 'topics': ['Repository and service layers', 'Dependency injection', 'Event-driven design'], 'notes': '## Architecture and Design Patterns\n\nThis advanced lesson in Python Programming develops the concepts needed to apply architecture and design patterns in practical coursework and projects.\n\n### Learning points\n- Repository and service layers\n- Dependency injection\n- Event-driven design\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Deployment and Automation', 'topics': ['Virtual environments and packaging', 'Containers overview', 'CI testing workflow'], 'notes': '## Deployment and Automation\n\nThis advanced lesson in Python Programming develops the concepts needed to apply deployment and automation in practical coursework and projects.\n\n### Learning points\n- Virtual environments and packaging\n- Containers overview\n- CI testing workflow\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Observability and Reliability', 'topics': ['Structured logging', 'Metrics and tracing', 'Retries and graceful failure'], 'notes': '## Observability and Reliability\n\nThis advanced lesson in Python Programming develops the concepts needed to apply observability and reliability in practical coursework and projects.\n\n### Learning points\n- Structured logging\n- Metrics and tracing\n- Retries and graceful failure\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: Production Python Service', 'topics': ['System design', 'Build and test service', 'Deploy, monitor and document'], 'notes': '## Capstone: Production Python Service\n\nThis advanced lesson in Python Programming develops the concepts needed to apply capstone: production python service in practical coursework and projects.\n\n### Learning points\n- System design\n- Build and test service\n- Deploy, monitor and document\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 9, 'name': 'Java Programming', 'title': 'Java Programming', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Java Programming, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Advanced Class Design', 'topics': ['Encapsulation and access control', 'Static members', 'Nested classes'], 'notes': '## Advanced Class Design\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply advanced class design in practical coursework and projects.\n\n### Learning points\n- Encapsulation and access control\n- Static members\n- Nested classes\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Interfaces and Abstract Classes', 'topics': ['Interface contracts', 'Abstract methods', 'Default and static interface methods'], 'notes': '## Interfaces and Abstract Classes\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply interfaces and abstract classes in practical coursework and projects.\n\n### Learning points\n- Interface contracts\n- Abstract methods\n- Default and static interface methods\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Collections Framework', 'topics': ['List, Set and Map', 'ArrayList and LinkedList', 'HashMap and TreeMap'], 'notes': '## Collections Framework\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply collections framework in practical coursework and projects.\n\n### Learning points\n- List, Set and Map\n- ArrayList and LinkedList\n- HashMap and TreeMap\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Generics', 'topics': ['Generic classes', 'Generic methods', 'Bounded type parameters'], 'notes': '## Generics\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply generics in practical coursework and projects.\n\n### Learning points\n- Generic classes\n- Generic methods\n- Bounded type parameters\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'String Processing', 'topics': ['String immutability', 'StringBuilder', 'Regular expressions'], 'notes': '## String Processing\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply string processing in practical coursework and projects.\n\n### Learning points\n- String immutability\n- StringBuilder\n- Regular expressions\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Exception Design', 'topics': ['Checked and unchecked exceptions', 'Custom exceptions', 'try-with-resources'], 'notes': '## Exception Design\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply exception design in practical coursework and projects.\n\n### Learning points\n- Checked and unchecked exceptions\n- Custom exceptions\n- try-with-resources\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'File I/O and NIO', 'topics': ['Byte and character streams', 'Buffered I/O', 'Path and Files API'], 'notes': '## File I/O and NIO\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply file i/o and nio in practical coursework and projects.\n\n### Learning points\n- Byte and character streams\n- Buffered I/O\n- Path and Files API\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Lambda Expressions', 'topics': ['Functional interfaces', 'Lambda syntax', 'Method references'], 'notes': '## Lambda Expressions\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply lambda expressions in practical coursework and projects.\n\n### Learning points\n- Functional interfaces\n- Lambda syntax\n- Method references\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Stream API', 'topics': ['Intermediate operations', 'Terminal operations', 'Collectors'], 'notes': '## Stream API\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply stream api in practical coursework and projects.\n\n### Learning points\n- Intermediate operations\n- Terminal operations\n- Collectors\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Multithreading', 'topics': ['Thread lifecycle', 'Runnable and Callable', 'Synchronization basics'], 'notes': '## Multithreading\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply multithreading in practical coursework and projects.\n\n### Learning points\n- Thread lifecycle\n- Runnable and Callable\n- Synchronization basics\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Concurrency Utilities', 'topics': ['ExecutorService', 'Locks and atomics', 'Concurrent collections'], 'notes': '## Concurrency Utilities\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply concurrency utilities in practical coursework and projects.\n\n### Learning points\n- ExecutorService\n- Locks and atomics\n- Concurrent collections\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'JDBC Database Access', 'topics': ['JDBC workflow', 'PreparedStatement', 'Transactions'], 'notes': '## JDBC Database Access\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply jdbc database access in practical coursework and projects.\n\n### Learning points\n- JDBC workflow\n- PreparedStatement\n- Transactions\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Unit Testing with JUnit', 'topics': ['Test cases and assertions', 'Test fixtures', 'Parameterized tests'], 'notes': '## Unit Testing with JUnit\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply unit testing with junit in practical coursework and projects.\n\n### Learning points\n- Test cases and assertions\n- Test fixtures\n- Parameterized tests\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Networking Basics', 'topics': ['Sockets overview', 'HTTP client', 'JSON data exchange'], 'notes': '## Networking Basics\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply networking basics in practical coursework and projects.\n\n### Learning points\n- Sockets overview\n- HTTP client\n- JSON data exchange\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Build Tools and Project Structure', 'topics': ['Maven or Gradle basics', 'Dependencies', 'Project packaging'], 'notes': '## Build Tools and Project Structure\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply build tools and project structure in practical coursework and projects.\n\n### Learning points\n- Maven or Gradle basics\n- Dependencies\n- Project packaging\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Java Application Project', 'topics': ['Design classes', 'Connect database and tests', 'Build and document application'], 'notes': '## Java Application Project\n\nThis intermediate lesson in Java Programming develops the concepts needed to apply java application project in practical coursework and projects.\n\n### Learning points\n- Design classes\n- Connect database and tests\n- Build and document application\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 10, 'name': 'Java Programming', 'title': 'Java Programming', 'level': 'Advanced', 'description': 'A structured advanced learning path for Java Programming, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'JVM Architecture', 'topics': ['Class loading', 'Runtime memory areas', 'Bytecode execution'], 'notes': '## JVM Architecture\n\nThis advanced lesson in Java Programming develops the concepts needed to apply jvm architecture in practical coursework and projects.\n\n### Learning points\n- Class loading\n- Runtime memory areas\n- Bytecode execution\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Generics', 'topics': ['Wildcards', 'Type erasure', 'Generic API design'], 'notes': '## Advanced Generics\n\nThis advanced lesson in Java Programming develops the concepts needed to apply advanced generics in practical coursework and projects.\n\n### Learning points\n- Wildcards\n- Type erasure\n- Generic API design\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Reflection and Annotations', 'topics': ['Reflection API', 'Custom annotations', 'Annotation processing overview'], 'notes': '## Reflection and Annotations\n\nThis advanced lesson in Java Programming develops the concepts needed to apply reflection and annotations in practical coursework and projects.\n\n### Learning points\n- Reflection API\n- Custom annotations\n- Annotation processing overview\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Concurrency', 'topics': ['Thread pools', 'CompletableFuture', 'Concurrent design patterns'], 'notes': '## Advanced Concurrency\n\nThis advanced lesson in Java Programming develops the concepts needed to apply advanced concurrency in practical coursework and projects.\n\n### Learning points\n- Thread pools\n- CompletableFuture\n- Concurrent design patterns\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Java Memory Model', 'topics': ['Visibility and happens-before', 'Volatile and synchronization', 'Safe publication'], 'notes': '## Java Memory Model\n\nThis advanced lesson in Java Programming develops the concepts needed to apply java memory model in practical coursework and projects.\n\n### Learning points\n- Visibility and happens-before\n- Volatile and synchronization\n- Safe publication\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Performance and Profiling', 'topics': ['JVM garbage collectors', 'Profiling CPU and memory', 'Benchmarking with JMH concepts'], 'notes': '## Performance and Profiling\n\nThis advanced lesson in Java Programming develops the concepts needed to apply performance and profiling in practical coursework and projects.\n\n### Learning points\n- JVM garbage collectors\n- Profiling CPU and memory\n- Benchmarking with JMH concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Reactive Programming', 'topics': ['Reactive streams', 'Backpressure', 'Asynchronous pipelines'], 'notes': '## Reactive Programming\n\nThis advanced lesson in Java Programming develops the concepts needed to apply reactive programming in practical coursework and projects.\n\n### Learning points\n- Reactive streams\n- Backpressure\n- Asynchronous pipelines\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Stream Processing', 'topics': ['Custom collectors', 'Parallel streams', 'Stream performance'], 'notes': '## Advanced Stream Processing\n\nThis advanced lesson in Java Programming develops the concepts needed to apply advanced stream processing in practical coursework and projects.\n\n### Learning points\n- Custom collectors\n- Parallel streams\n- Stream performance\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Design Patterns in Java', 'topics': ['Factory and Builder', 'Strategy and Observer', 'Decorator and Adapter'], 'notes': '## Design Patterns in Java\n\nThis advanced lesson in Java Programming develops the concepts needed to apply design patterns in java in practical coursework and projects.\n\n### Learning points\n- Factory and Builder\n- Strategy and Observer\n- Decorator and Adapter\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Spring Core Concepts', 'topics': ['IoC container', 'Dependency injection', 'Bean lifecycle'], 'notes': '## Spring Core Concepts\n\nThis advanced lesson in Java Programming develops the concepts needed to apply spring core concepts in practical coursework and projects.\n\n### Learning points\n- IoC container\n- Dependency injection\n- Bean lifecycle\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Building REST Services', 'topics': ['Controller and service layers', 'Validation and error responses', 'API documentation'], 'notes': '## Building REST Services\n\nThis advanced lesson in Java Programming develops the concepts needed to apply building rest services in practical coursework and projects.\n\n### Learning points\n- Controller and service layers\n- Validation and error responses\n- API documentation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Persistence with JPA', 'topics': ['Entities and relationships', 'JPQL and repositories', 'Transactions and fetching'], 'notes': '## Persistence with JPA\n\nThis advanced lesson in Java Programming develops the concepts needed to apply persistence with jpa in practical coursework and projects.\n\n### Learning points\n- Entities and relationships\n- JPQL and repositories\n- Transactions and fetching\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Application Security', 'topics': ['Authentication and authorization', 'Password hashing concepts', 'Input and output safety'], 'notes': '## Application Security\n\nThis advanced lesson in Java Programming develops the concepts needed to apply application security in practical coursework and projects.\n\n### Learning points\n- Authentication and authorization\n- Password hashing concepts\n- Input and output safety\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Microservices Foundations', 'topics': ['Service boundaries', 'Service communication', 'Resilience patterns'], 'notes': '## Microservices Foundations\n\nThis advanced lesson in Java Programming develops the concepts needed to apply microservices foundations in practical coursework and projects.\n\n### Learning points\n- Service boundaries\n- Service communication\n- Resilience patterns\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Testing Enterprise Applications', 'topics': ['Integration tests', 'Mocking dependencies', 'Test containers concepts'], 'notes': '## Testing Enterprise Applications\n\nThis advanced lesson in Java Programming develops the concepts needed to apply testing enterprise applications in practical coursework and projects.\n\n### Learning points\n- Integration tests\n- Mocking dependencies\n- Test containers concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: Enterprise Java API', 'topics': ['Architecture and implementation', 'Security and persistence', 'Testing and deployment'], 'notes': '## Capstone: Enterprise Java API\n\nThis advanced lesson in Java Programming develops the concepts needed to apply capstone: enterprise java api in practical coursework and projects.\n\n### Learning points\n- Architecture and implementation\n- Security and persistence\n- Testing and deployment\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 11, 'name': 'Web Development', 'title': 'Web Development', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Web Development, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Modern JavaScript and ES Modules', 'topics': ['Destructuring and spread', 'Modules and imports', 'Optional chaining'], 'notes': '## Modern JavaScript and ES Modules\n\nThis intermediate lesson in Web Development develops the concepts needed to apply modern javascript and es modules in practical coursework and projects.\n\n### Learning points\n- Destructuring and spread\n- Modules and imports\n- Optional chaining\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Asynchronous JavaScript', 'topics': ['Promises', 'async and await', 'Error handling'], 'notes': '## Asynchronous JavaScript\n\nThis intermediate lesson in Web Development develops the concepts needed to apply asynchronous javascript in practical coursework and projects.\n\n### Learning points\n- Promises\n- async and await\n- Error handling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced DOM and Events', 'topics': ['Event propagation', 'Event delegation', 'Dynamic interfaces'], 'notes': '## Advanced DOM and Events\n\nThis intermediate lesson in Web Development develops the concepts needed to apply advanced dom and events in practical coursework and projects.\n\n### Learning points\n- Event propagation\n- Event delegation\n- Dynamic interfaces\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Browser Storage', 'topics': ['Local and session storage', 'Cookies overview', 'IndexedDB concepts'], 'notes': '## Browser Storage\n\nThis intermediate lesson in Web Development develops the concepts needed to apply browser storage in practical coursework and projects.\n\n### Learning points\n- Local and session storage\n- Cookies overview\n- IndexedDB concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'HTTP and REST APIs', 'topics': ['HTTP methods and status codes', 'Fetch API', 'JSON request and response'], 'notes': '## HTTP and REST APIs\n\nThis intermediate lesson in Web Development develops the concepts needed to apply http and rest apis in practical coursework and projects.\n\n### Learning points\n- HTTP methods and status codes\n- Fetch API\n- JSON request and response\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Responsive Layout Systems', 'topics': ['Advanced Flexbox', 'CSS Grid patterns', 'Responsive breakpoints'], 'notes': '## Responsive Layout Systems\n\nThis intermediate lesson in Web Development develops the concepts needed to apply responsive layout systems in practical coursework and projects.\n\n### Learning points\n- Advanced Flexbox\n- CSS Grid patterns\n- Responsive breakpoints\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'CSS Architecture', 'topics': ['Reusable components', 'CSS variables', 'BEM and modular styles'], 'notes': '## CSS Architecture\n\nThis intermediate lesson in Web Development develops the concepts needed to apply css architecture in practical coursework and projects.\n\n### Learning points\n- Reusable components\n- CSS variables\n- BEM and modular styles\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Accessibility Engineering', 'topics': ['Semantic HTML', 'Keyboard navigation', 'Accessible forms'], 'notes': '## Accessibility Engineering\n\nThis intermediate lesson in Web Development develops the concepts needed to apply accessibility engineering in practical coursework and projects.\n\n### Learning points\n- Semantic HTML\n- Keyboard navigation\n- Accessible forms\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'React Components and Props', 'topics': ['Component composition', 'Props and state', 'Rendering lists'], 'notes': '## React Components and Props\n\nThis intermediate lesson in Web Development develops the concepts needed to apply react components and props in practical coursework and projects.\n\n### Learning points\n- Component composition\n- Props and state\n- Rendering lists\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'React Hooks', 'topics': ['useState and useEffect', 'Custom hooks', 'Effect cleanup'], 'notes': '## React Hooks\n\nThis intermediate lesson in Web Development develops the concepts needed to apply react hooks in practical coursework and projects.\n\n### Learning points\n- useState and useEffect\n- Custom hooks\n- Effect cleanup\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Routing and Navigation', 'topics': ['Client-side routing', 'Route parameters', 'Protected route concepts'], 'notes': '## Routing and Navigation\n\nThis intermediate lesson in Web Development develops the concepts needed to apply routing and navigation in practical coursework and projects.\n\n### Learning points\n- Client-side routing\n- Route parameters\n- Protected route concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Forms and Validation', 'topics': ['Controlled forms', 'Client-side validation', 'Accessible error messages'], 'notes': '## Forms and Validation\n\nThis intermediate lesson in Web Development develops the concepts needed to apply forms and validation in practical coursework and projects.\n\n### Learning points\n- Controlled forms\n- Client-side validation\n- Accessible error messages\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Frontend State Management', 'topics': ['Context API', 'State normalization', 'When to use external stores'], 'notes': '## Frontend State Management\n\nThis intermediate lesson in Web Development develops the concepts needed to apply frontend state management in practical coursework and projects.\n\n### Learning points\n- Context API\n- State normalization\n- When to use external stores\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Testing Frontend Applications', 'topics': ['Unit testing', 'Component testing', 'Browser testing'], 'notes': '## Testing Frontend Applications\n\nThis intermediate lesson in Web Development develops the concepts needed to apply testing frontend applications in practical coursework and projects.\n\n### Learning points\n- Unit testing\n- Component testing\n- Browser testing\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Performance and Optimization', 'topics': ['Code splitting', 'Lazy loading', 'Web vitals'], 'notes': '## Performance and Optimization\n\nThis intermediate lesson in Web Development develops the concepts needed to apply performance and optimization in practical coursework and projects.\n\n### Learning points\n- Code splitting\n- Lazy loading\n- Web vitals\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Full-Stack Web Project', 'topics': ['Connect frontend to API', 'Authentication flow concepts', 'Deploy and test application'], 'notes': '## Full-Stack Web Project\n\nThis intermediate lesson in Web Development develops the concepts needed to apply full-stack web project in practical coursework and projects.\n\n### Learning points\n- Connect frontend to API\n- Authentication flow concepts\n- Deploy and test application\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 12, 'name': 'Web Development', 'title': 'Web Development', 'level': 'Advanced', 'description': 'A structured advanced learning path for Web Development, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Frontend Architecture', 'topics': ['Feature-based structure', 'Design systems', 'Component boundaries'], 'notes': '## Frontend Architecture\n\nThis advanced lesson in Web Development develops the concepts needed to apply frontend architecture in practical coursework and projects.\n\n### Learning points\n- Feature-based structure\n- Design systems\n- Component boundaries\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'TypeScript for Applications', 'topics': ['Types and interfaces', 'Generics', 'Type-safe API models'], 'notes': '## TypeScript for Applications\n\nThis advanced lesson in Web Development develops the concepts needed to apply typescript for applications in practical coursework and projects.\n\n### Learning points\n- Types and interfaces\n- Generics\n- Type-safe API models\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced React Patterns', 'topics': ['Compound components', 'Render props and hooks', 'Error boundaries'], 'notes': '## Advanced React Patterns\n\nThis advanced lesson in Web Development develops the concepts needed to apply advanced react patterns in practical coursework and projects.\n\n### Learning points\n- Compound components\n- Render props and hooks\n- Error boundaries\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Server Rendering Concepts', 'topics': ['SSR and hydration', 'Static generation', 'Rendering trade-offs'], 'notes': '## Server Rendering Concepts\n\nThis advanced lesson in Web Development develops the concepts needed to apply server rendering concepts in practical coursework and projects.\n\n### Learning points\n- SSR and hydration\n- Static generation\n- Rendering trade-offs\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced State and Data Fetching', 'topics': ['Caching strategies', 'Optimistic updates', 'Server state patterns'], 'notes': '## Advanced State and Data Fetching\n\nThis advanced lesson in Web Development develops the concepts needed to apply advanced state and data fetching in practical coursework and projects.\n\n### Learning points\n- Caching strategies\n- Optimistic updates\n- Server state patterns\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Web Security', 'topics': ['XSS and CSRF concepts', 'Content security policy', 'Secure session handling'], 'notes': '## Web Security\n\nThis advanced lesson in Web Development develops the concepts needed to apply web security in practical coursework and projects.\n\n### Learning points\n- XSS and CSRF concepts\n- Content security policy\n- Secure session handling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Web Performance Engineering', 'topics': ['Rendering performance', 'Bundle analysis', 'Caching and CDN concepts'], 'notes': '## Web Performance Engineering\n\nThis advanced lesson in Web Development develops the concepts needed to apply web performance engineering in practical coursework and projects.\n\n### Learning points\n- Rendering performance\n- Bundle analysis\n- Caching and CDN concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Progressive Web Apps', 'topics': ['Service workers', 'Offline strategies', 'Web app manifests'], 'notes': '## Progressive Web Apps\n\nThis advanced lesson in Web Development develops the concepts needed to apply progressive web apps in practical coursework and projects.\n\n### Learning points\n- Service workers\n- Offline strategies\n- Web app manifests\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Real-Time Web Applications', 'topics': ['WebSockets', 'Server-sent events', 'Live update patterns'], 'notes': '## Real-Time Web Applications\n\nThis advanced lesson in Web Development develops the concepts needed to apply real-time web applications in practical coursework and projects.\n\n### Learning points\n- WebSockets\n- Server-sent events\n- Live update patterns\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'GraphQL and API Design', 'topics': ['Schema and queries', 'Mutations', 'Pagination and caching'], 'notes': '## GraphQL and API Design\n\nThis advanced lesson in Web Development develops the concepts needed to apply graphql and api design in practical coursework and projects.\n\n### Learning points\n- Schema and queries\n- Mutations\n- Pagination and caching\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Backend with Node.js', 'topics': ['Event loop', 'Express middleware', 'Validation and error handling'], 'notes': '## Backend with Node.js\n\nThis advanced lesson in Web Development develops the concepts needed to apply backend with node.js in practical coursework and projects.\n\n### Learning points\n- Event loop\n- Express middleware\n- Validation and error handling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database and ORM Integration', 'topics': ['Relational modeling', 'ORM patterns', 'Transactions and migrations'], 'notes': '## Database and ORM Integration\n\nThis advanced lesson in Web Development develops the concepts needed to apply database and orm integration in practical coursework and projects.\n\n### Learning points\n- Relational modeling\n- ORM patterns\n- Transactions and migrations\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Automated Delivery', 'topics': ['Build pipelines', 'Continuous integration', 'Safe deployment strategies'], 'notes': '## Automated Delivery\n\nThis advanced lesson in Web Development develops the concepts needed to apply automated delivery in practical coursework and projects.\n\n### Learning points\n- Build pipelines\n- Continuous integration\n- Safe deployment strategies\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Observability', 'topics': ['Client error reporting', 'Logging and tracing', 'Performance monitoring'], 'notes': '## Observability\n\nThis advanced lesson in Web Development develops the concepts needed to apply observability in practical coursework and projects.\n\n### Learning points\n- Client error reporting\n- Logging and tracing\n- Performance monitoring\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Scalable Application Design', 'topics': ['Load balancing concepts', 'Horizontal scaling', 'Resilience and rate limits'], 'notes': '## Scalable Application Design\n\nThis advanced lesson in Web Development develops the concepts needed to apply scalable application design in practical coursework and projects.\n\n### Learning points\n- Load balancing concepts\n- Horizontal scaling\n- Resilience and rate limits\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: Scalable Web Platform', 'topics': ['System design', 'Implement and secure platform', 'Test, deploy and monitor'], 'notes': '## Capstone: Scalable Web Platform\n\nThis advanced lesson in Web Development develops the concepts needed to apply capstone: scalable web platform in practical coursework and projects.\n\n### Learning points\n- System design\n- Implement and secure platform\n- Test, deploy and monitor\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 13, 'name': 'Data Structures', 'title': 'Data Structures', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Data Structures, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Algorithm Analysis', 'topics': ['Big O notation', 'Time and space complexity', 'Best, average and worst cases'], 'notes': '## Algorithm Analysis\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply algorithm analysis in practical coursework and projects.\n\n### Learning points\n- Big O notation\n- Time and space complexity\n- Best, average and worst cases\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Array Techniques', 'topics': ['Two pointers', 'Sliding window', 'Prefix sums'], 'notes': '## Array Techniques\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply array techniques in practical coursework and projects.\n\n### Learning points\n- Two pointers\n- Sliding window\n- Prefix sums\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Linked List Algorithms', 'topics': ['Reverse a list', 'Cycle detection', 'Merge sorted lists'], 'notes': '## Linked List Algorithms\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply linked list algorithms in practical coursework and projects.\n\n### Learning points\n- Reverse a list\n- Cycle detection\n- Merge sorted lists\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Stack Applications', 'topics': ['Balanced parentheses', 'Monotonic stacks', 'Expression evaluation'], 'notes': '## Stack Applications\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply stack applications in practical coursework and projects.\n\n### Learning points\n- Balanced parentheses\n- Monotonic stacks\n- Expression evaluation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Queue Variants', 'topics': ['Deque', 'Priority queue', 'Circular buffer'], 'notes': '## Queue Variants\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply queue variants in practical coursework and projects.\n\n### Learning points\n- Deque\n- Priority queue\n- Circular buffer\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Hash Tables in Practice', 'topics': ['Hash functions', 'Collision strategies', 'Frequency counting'], 'notes': '## Hash Tables in Practice\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply hash tables in practice in practical coursework and projects.\n\n### Learning points\n- Hash functions\n- Collision strategies\n- Frequency counting\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Recursion', 'topics': ['Call stack', 'Base and recursive cases', 'Backtracking basics'], 'notes': '## Recursion\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply recursion in practical coursework and projects.\n\n### Learning points\n- Call stack\n- Base and recursive cases\n- Backtracking basics\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Divide and Conquer', 'topics': ['Problem decomposition', 'Merge sort', 'Quick sort'], 'notes': '## Divide and Conquer\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply divide and conquer in practical coursework and projects.\n\n### Learning points\n- Problem decomposition\n- Merge sort\n- Quick sort\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Sorting', 'topics': ['Heap sort', 'Counting and radix sort', 'Stability and trade-offs'], 'notes': '## Advanced Sorting\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply advanced sorting in practical coursework and projects.\n\n### Learning points\n- Heap sort\n- Counting and radix sort\n- Stability and trade-offs\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Binary Search Patterns', 'topics': ['Boundary search', 'Search on answer', 'Rotated sorted arrays'], 'notes': '## Binary Search Patterns\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply binary search patterns in practical coursework and projects.\n\n### Learning points\n- Boundary search\n- Search on answer\n- Rotated sorted arrays\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Trees and Traversals', 'topics': ['DFS traversals', 'BFS level order', 'Tree height and diameter'], 'notes': '## Trees and Traversals\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply trees and traversals in practical coursework and projects.\n\n### Learning points\n- DFS traversals\n- BFS level order\n- Tree height and diameter\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Binary Search Trees', 'topics': ['Search and update', 'Balanced tree concept', 'BST validation'], 'notes': '## Binary Search Trees\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply binary search trees in practical coursework and projects.\n\n### Learning points\n- Search and update\n- Balanced tree concept\n- BST validation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Heaps and Priority Queues', 'topics': ['Heap property', 'Heap operations', 'Top-k problems'], 'notes': '## Heaps and Priority Queues\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply heaps and priority queues in practical coursework and projects.\n\n### Learning points\n- Heap property\n- Heap operations\n- Top-k problems\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Graph Representations', 'topics': ['Adjacency list and matrix', 'BFS and DFS', 'Connected components'], 'notes': '## Graph Representations\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply graph representations in practical coursework and projects.\n\n### Learning points\n- Adjacency list and matrix\n- BFS and DFS\n- Connected components\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Greedy Algorithms', 'topics': ['Greedy choice', 'Interval scheduling', 'Correctness reasoning'], 'notes': '## Greedy Algorithms\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply greedy algorithms in practical coursework and projects.\n\n### Learning points\n- Greedy choice\n- Interval scheduling\n- Correctness reasoning\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Algorithm Practice Project', 'topics': ['Select problems', 'Implement and analyze solutions', 'Test edge cases'], 'notes': '## Algorithm Practice Project\n\nThis intermediate lesson in Data Structures develops the concepts needed to apply algorithm practice project in practical coursework and projects.\n\n### Learning points\n- Select problems\n- Implement and analyze solutions\n- Test edge cases\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 14, 'name': 'Data Structures', 'title': 'Data Structures', 'level': 'Advanced', 'description': 'A structured advanced learning path for Data Structures, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Advanced Complexity Analysis', 'topics': ['Amortized analysis', 'Recurrence relations', 'Lower bounds'], 'notes': '## Advanced Complexity Analysis\n\nThis advanced lesson in Data Structures develops the concepts needed to apply advanced complexity analysis in practical coursework and projects.\n\n### Learning points\n- Amortized analysis\n- Recurrence relations\n- Lower bounds\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Balanced Search Trees', 'topics': ['AVL rotations', 'Red-black tree properties', 'B-tree concepts'], 'notes': '## Balanced Search Trees\n\nThis advanced lesson in Data Structures develops the concepts needed to apply balanced search trees in practical coursework and projects.\n\n### Learning points\n- AVL rotations\n- Red-black tree properties\n- B-tree concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Tries and String Indexing', 'topics': ['Trie operations', 'Prefix search', 'Compressed tries'], 'notes': '## Tries and String Indexing\n\nThis advanced lesson in Data Structures develops the concepts needed to apply tries and string indexing in practical coursework and projects.\n\n### Learning points\n- Trie operations\n- Prefix search\n- Compressed tries\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Heap Structures', 'topics': ['Binary and d-ary heaps', 'Binomial heap concepts', 'Fibonacci heap overview'], 'notes': '## Advanced Heap Structures\n\nThis advanced lesson in Data Structures develops the concepts needed to apply advanced heap structures in practical coursework and projects.\n\n### Learning points\n- Binary and d-ary heaps\n- Binomial heap concepts\n- Fibonacci heap overview\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Disjoint Set Union', 'topics': ['Find and union', 'Path compression', 'Union by rank'], 'notes': '## Disjoint Set Union\n\nThis advanced lesson in Data Structures develops the concepts needed to apply disjoint set union in practical coursework and projects.\n\n### Learning points\n- Find and union\n- Path compression\n- Union by rank\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Shortest Path Algorithms', 'topics': ['Dijkstra algorithm', 'Bellman-Ford', 'Floyd-Warshall'], 'notes': '## Shortest Path Algorithms\n\nThis advanced lesson in Data Structures develops the concepts needed to apply shortest path algorithms in practical coursework and projects.\n\n### Learning points\n- Dijkstra algorithm\n- Bellman-Ford\n- Floyd-Warshall\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Minimum Spanning Trees', 'topics': ['Kruskal algorithm', 'Prim algorithm', 'Cut property'], 'notes': '## Minimum Spanning Trees\n\nThis advanced lesson in Data Structures develops the concepts needed to apply minimum spanning trees in practical coursework and projects.\n\n### Learning points\n- Kruskal algorithm\n- Prim algorithm\n- Cut property\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Graph Traversal', 'topics': ['Topological sorting', 'Strongly connected components', 'Bridge and articulation points'], 'notes': '## Advanced Graph Traversal\n\nThis advanced lesson in Data Structures develops the concepts needed to apply advanced graph traversal in practical coursework and projects.\n\n### Learning points\n- Topological sorting\n- Strongly connected components\n- Bridge and articulation points\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Network Flow', 'topics': ['Flow networks', 'Ford-Fulkerson idea', 'Maximum flow applications'], 'notes': '## Network Flow\n\nThis advanced lesson in Data Structures develops the concepts needed to apply network flow in practical coursework and projects.\n\n### Learning points\n- Flow networks\n- Ford-Fulkerson idea\n- Maximum flow applications\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Dynamic Programming Foundations', 'topics': ['State definition', 'Memoization and tabulation', 'Transition design'], 'notes': '## Dynamic Programming Foundations\n\nThis advanced lesson in Data Structures develops the concepts needed to apply dynamic programming foundations in practical coursework and projects.\n\n### Learning points\n- State definition\n- Memoization and tabulation\n- Transition design\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Dynamic Programming', 'topics': ['Knapsack variants', 'Longest increasing subsequence', 'DP on trees'], 'notes': '## Advanced Dynamic Programming\n\nThis advanced lesson in Data Structures develops the concepts needed to apply advanced dynamic programming in practical coursework and projects.\n\n### Learning points\n- Knapsack variants\n- Longest increasing subsequence\n- DP on trees\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'String Matching', 'topics': ['KMP algorithm', 'Rabin-Karp', 'Z algorithm'], 'notes': '## String Matching\n\nThis advanced lesson in Data Structures develops the concepts needed to apply string matching in practical coursework and projects.\n\n### Learning points\n- KMP algorithm\n- Rabin-Karp\n- Z algorithm\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Range Queries', 'topics': ['Fenwick tree', 'Segment tree', 'Lazy propagation'], 'notes': '## Advanced Range Queries\n\nThis advanced lesson in Data Structures develops the concepts needed to apply advanced range queries in practical coursework and projects.\n\n### Learning points\n- Fenwick tree\n- Segment tree\n- Lazy propagation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Offline and Sweep-Line Techniques', 'topics': ['Coordinate compression', 'Sweep-line events', 'Offline query processing'], 'notes': '## Offline and Sweep-Line Techniques\n\nThis advanced lesson in Data Structures develops the concepts needed to apply offline and sweep-line techniques in practical coursework and projects.\n\n### Learning points\n- Coordinate compression\n- Sweep-line events\n- Offline query processing\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Randomized Algorithms', 'topics': ['Randomized quicksort', 'Hashing probability', 'Expected complexity'], 'notes': '## Randomized Algorithms\n\nThis advanced lesson in Data Structures develops the concepts needed to apply randomized algorithms in practical coursework and projects.\n\n### Learning points\n- Randomized quicksort\n- Hashing probability\n- Expected complexity\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: Algorithmic Problem Suite', 'topics': ['Choose constraints', 'Design optimal solutions', 'Benchmark and explain complexity'], 'notes': '## Capstone: Algorithmic Problem Suite\n\nThis advanced lesson in Data Structures develops the concepts needed to apply capstone: algorithmic problem suite in practical coursework and projects.\n\n### Learning points\n- Choose constraints\n- Design optimal solutions\n- Benchmark and explain complexity\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 15, 'name': 'Artificial Intelligence', 'title': 'Artificial Intelligence', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Artificial Intelligence, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Python for AI Workflows', 'topics': ['NumPy arrays', 'Pandas dataframes', 'Notebook workflow'], 'notes': '## Python for AI Workflows\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply python for ai workflows in practical coursework and projects.\n\n### Learning points\n- NumPy arrays\n- Pandas dataframes\n- Notebook workflow\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Mathematics for Machine Learning', 'topics': ['Vectors and matrices', 'Probability basics', 'Derivatives and gradients'], 'notes': '## Mathematics for Machine Learning\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply mathematics for machine learning in practical coursework and projects.\n\n### Learning points\n- Vectors and matrices\n- Probability basics\n- Derivatives and gradients\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Data Collection and Quality', 'topics': ['Data sources', 'Missing and inconsistent values', 'Data documentation'], 'notes': '## Data Collection and Quality\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply data collection and quality in practical coursework and projects.\n\n### Learning points\n- Data sources\n- Missing and inconsistent values\n- Data documentation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Exploratory Data Analysis', 'topics': ['Summary statistics', 'Visual exploration', 'Outlier investigation'], 'notes': '## Exploratory Data Analysis\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply exploratory data analysis in practical coursework and projects.\n\n### Learning points\n- Summary statistics\n- Visual exploration\n- Outlier investigation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Feature Engineering', 'topics': ['Encoding categories', 'Scaling numerical data', 'Feature selection'], 'notes': '## Feature Engineering\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply feature engineering in practical coursework and projects.\n\n### Learning points\n- Encoding categories\n- Scaling numerical data\n- Feature selection\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Supervised Learning Workflow', 'topics': ['Train and test split', 'Baseline models', 'Model pipelines'], 'notes': '## Supervised Learning Workflow\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply supervised learning workflow in practical coursework and projects.\n\n### Learning points\n- Train and test split\n- Baseline models\n- Model pipelines\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Regression Models', 'topics': ['Linear regression', 'Regularization overview', 'Regression metrics'], 'notes': '## Regression Models\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply regression models in practical coursework and projects.\n\n### Learning points\n- Linear regression\n- Regularization overview\n- Regression metrics\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Classification Models', 'topics': ['Logistic regression', 'Decision trees', 'Classification metrics'], 'notes': '## Classification Models\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply classification models in practical coursework and projects.\n\n### Learning points\n- Logistic regression\n- Decision trees\n- Classification metrics\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Model Validation', 'topics': ['Cross-validation', 'Hyperparameter tuning', 'Data leakage prevention'], 'notes': '## Model Validation\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply model validation in practical coursework and projects.\n\n### Learning points\n- Cross-validation\n- Hyperparameter tuning\n- Data leakage prevention\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Unsupervised Learning', 'topics': ['K-means clustering', 'Hierarchical clustering', 'Dimensionality reduction'], 'notes': '## Unsupervised Learning\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply unsupervised learning in practical coursework and projects.\n\n### Learning points\n- K-means clustering\n- Hierarchical clustering\n- Dimensionality reduction\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Ensemble Learning', 'topics': ['Random forests', 'Gradient boosting concepts', 'Model comparison'], 'notes': '## Ensemble Learning\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply ensemble learning in practical coursework and projects.\n\n### Learning points\n- Random forests\n- Gradient boosting concepts\n- Model comparison\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Introductory Neural Networks', 'topics': ['Perceptron', 'Activation functions', 'Training loop concepts'], 'notes': '## Introductory Neural Networks\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply introductory neural networks in practical coursework and projects.\n\n### Learning points\n- Perceptron\n- Activation functions\n- Training loop concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Natural Language Processing', 'topics': ['Text cleaning', 'Bag of words and TF-IDF', 'Text classification'], 'notes': '## Natural Language Processing\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply natural language processing in practical coursework and projects.\n\n### Learning points\n- Text cleaning\n- Bag of words and TF-IDF\n- Text classification\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Computer Vision Basics', 'topics': ['Image representation', 'Image preprocessing', 'CNN concepts'], 'notes': '## Computer Vision Basics\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply computer vision basics in practical coursework and projects.\n\n### Learning points\n- Image representation\n- Image preprocessing\n- CNN concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Responsible Machine Learning', 'topics': ['Bias and fairness', 'Privacy and consent', 'Explainability basics'], 'notes': '## Responsible Machine Learning\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply responsible machine learning in practical coursework and projects.\n\n### Learning points\n- Bias and fairness\n- Privacy and consent\n- Explainability basics\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Applied ML Project', 'topics': ['Define problem and metric', 'Train and evaluate model', 'Present limitations and results'], 'notes': '## Applied ML Project\n\nThis intermediate lesson in Artificial Intelligence develops the concepts needed to apply applied ml project in practical coursework and projects.\n\n### Learning points\n- Define problem and metric\n- Train and evaluate model\n- Present limitations and results\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 16, 'name': 'Artificial Intelligence', 'title': 'Artificial Intelligence', 'level': 'Advanced', 'description': 'A structured advanced learning path for Artificial Intelligence, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Advanced Statistical Learning', 'topics': ['Bias-variance trade-off', 'Bayesian reasoning', 'Statistical estimation'], 'notes': '## Advanced Statistical Learning\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply advanced statistical learning in practical coursework and projects.\n\n### Learning points\n- Bias-variance trade-off\n- Bayesian reasoning\n- Statistical estimation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Optimization for Deep Learning', 'topics': ['Gradient descent variants', 'Learning rate schedules', 'Regularization methods'], 'notes': '## Optimization for Deep Learning\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply optimization for deep learning in practical coursework and projects.\n\n### Learning points\n- Gradient descent variants\n- Learning rate schedules\n- Regularization methods\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Deep Neural Network Design', 'topics': ['Architectures', 'Normalization and dropout', 'Initialization'], 'notes': '## Deep Neural Network Design\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply deep neural network design in practical coursework and projects.\n\n### Learning points\n- Architectures\n- Normalization and dropout\n- Initialization\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Convolutional Neural Networks', 'topics': ['Convolution and pooling', 'Transfer learning', 'Image evaluation'], 'notes': '## Convolutional Neural Networks\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply convolutional neural networks in practical coursework and projects.\n\n### Learning points\n- Convolution and pooling\n- Transfer learning\n- Image evaluation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Sequence Models', 'topics': ['RNN and LSTM concepts', 'Attention mechanism', 'Sequence evaluation'], 'notes': '## Sequence Models\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply sequence models in practical coursework and projects.\n\n### Learning points\n- RNN and LSTM concepts\n- Attention mechanism\n- Sequence evaluation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Transformer Architecture', 'topics': ['Self-attention', 'Encoder and decoder', 'Positional information'], 'notes': '## Transformer Architecture\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply transformer architecture in practical coursework and projects.\n\n### Learning points\n- Self-attention\n- Encoder and decoder\n- Positional information\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Large Language Model Concepts', 'topics': ['Tokenization', 'Pretraining and fine-tuning', 'Inference and context limits'], 'notes': '## Large Language Model Concepts\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply large language model concepts in practical coursework and projects.\n\n### Learning points\n- Tokenization\n- Pretraining and fine-tuning\n- Inference and context limits\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Generative AI Systems', 'topics': ['Autoencoders', 'GAN concepts', 'Diffusion model overview'], 'notes': '## Generative AI Systems\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply generative ai systems in practical coursework and projects.\n\n### Learning points\n- Autoencoders\n- GAN concepts\n- Diffusion model overview\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced NLP', 'topics': ['Embeddings', 'Information retrieval', 'Evaluation of language systems'], 'notes': '## Advanced NLP\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply advanced nlp in practical coursework and projects.\n\n### Learning points\n- Embeddings\n- Information retrieval\n- Evaluation of language systems\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Computer Vision', 'topics': ['Object detection', 'Image segmentation', 'Vision transformer overview'], 'notes': '## Advanced Computer Vision\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply advanced computer vision in practical coursework and projects.\n\n### Learning points\n- Object detection\n- Image segmentation\n- Vision transformer overview\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Reinforcement Learning', 'topics': ['Markov decision processes', 'Policy and value functions', 'Q-learning'], 'notes': '## Reinforcement Learning\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply reinforcement learning in practical coursework and projects.\n\n### Learning points\n- Markov decision processes\n- Policy and value functions\n- Q-learning\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'MLOps and Model Serving', 'topics': ['Experiment tracking', 'Model packaging', 'Serving and versioning'], 'notes': '## MLOps and Model Serving\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply mlops and model serving in practical coursework and projects.\n\n### Learning points\n- Experiment tracking\n- Model packaging\n- Serving and versioning\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Distributed Machine Learning', 'topics': ['Data and model parallelism', 'Distributed training concepts', 'Resource planning'], 'notes': '## Distributed Machine Learning\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply distributed machine learning in practical coursework and projects.\n\n### Learning points\n- Data and model parallelism\n- Distributed training concepts\n- Resource planning\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'AI Evaluation and Safety', 'topics': ['Robustness testing', 'Hallucination and reliability evaluation', 'Human oversight'], 'notes': '## AI Evaluation and Safety\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply ai evaluation and safety in practical coursework and projects.\n\n### Learning points\n- Robustness testing\n- Hallucination and reliability evaluation\n- Human oversight\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Research Reproduction', 'topics': ['Read a research paper', 'Reproduce baseline', 'Compare experimental results'], 'notes': '## Research Reproduction\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply research reproduction in practical coursework and projects.\n\n### Learning points\n- Read a research paper\n- Reproduce baseline\n- Compare experimental results\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: End-to-End AI System', 'topics': ['Define use case and dataset', 'Build and evaluate model', 'Deploy responsibly and document'], 'notes': '## Capstone: End-to-End AI System\n\nThis advanced lesson in Artificial Intelligence develops the concepts needed to apply capstone: end-to-end ai system in practical coursework and projects.\n\n### Learning points\n- Define use case and dataset\n- Build and evaluate model\n- Deploy responsibly and document\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 17, 'name': 'Database Management', 'title': 'Database Management', 'level': 'Intermediate', 'description': 'A structured intermediate learning path for Database Management, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Relational Database Design', 'topics': ['Entities and attributes', 'Relationships and cardinality', 'ER diagrams'], 'notes': '## Relational Database Design\n\nThis intermediate lesson in Database Management develops the concepts needed to apply relational database design in practical coursework and projects.\n\n### Learning points\n- Entities and attributes\n- Relationships and cardinality\n- ER diagrams\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Normalization', 'topics': ['Functional dependencies', 'First to third normal forms', 'Normalization trade-offs'], 'notes': '## Normalization\n\nThis intermediate lesson in Database Management develops the concepts needed to apply normalization in practical coursework and projects.\n\n### Learning points\n- Functional dependencies\n- First to third normal forms\n- Normalization trade-offs\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced SQL Queries', 'topics': ['Subqueries', 'Common table expressions', 'Window functions'], 'notes': '## Advanced SQL Queries\n\nThis intermediate lesson in Database Management develops the concepts needed to apply advanced sql queries in practical coursework and projects.\n\n### Learning points\n- Subqueries\n- Common table expressions\n- Window functions\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'SQL Joins in Depth', 'topics': ['Inner and outer joins', 'Self joins', 'Set operations'], 'notes': '## SQL Joins in Depth\n\nThis intermediate lesson in Database Management develops the concepts needed to apply sql joins in depth in practical coursework and projects.\n\n### Learning points\n- Inner and outer joins\n- Self joins\n- Set operations\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Indexes and Query Performance', 'topics': ['Index types', 'Execution plans', 'Index trade-offs'], 'notes': '## Indexes and Query Performance\n\nThis intermediate lesson in Database Management develops the concepts needed to apply indexes and query performance in practical coursework and projects.\n\n### Learning points\n- Index types\n- Execution plans\n- Index trade-offs\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Transactions', 'topics': ['ACID properties', 'Commit and rollback', 'Isolation levels'], 'notes': '## Transactions\n\nThis intermediate lesson in Database Management develops the concepts needed to apply transactions in practical coursework and projects.\n\n### Learning points\n- ACID properties\n- Commit and rollback\n- Isolation levels\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Concurrency Control', 'topics': ['Locks', 'Deadlocks', 'MVCC concepts'], 'notes': '## Concurrency Control\n\nThis intermediate lesson in Database Management develops the concepts needed to apply concurrency control in practical coursework and projects.\n\n### Learning points\n- Locks\n- Deadlocks\n- MVCC concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Views and Stored Programs', 'topics': ['Views', 'Stored procedures', 'Functions and triggers'], 'notes': '## Views and Stored Programs\n\nThis intermediate lesson in Database Management develops the concepts needed to apply views and stored programs in practical coursework and projects.\n\n### Learning points\n- Views\n- Stored procedures\n- Functions and triggers\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Security', 'topics': ['Users and roles', 'Least privilege', 'SQL injection prevention'], 'notes': '## Database Security\n\nThis intermediate lesson in Database Management develops the concepts needed to apply database security in practical coursework and projects.\n\n### Learning points\n- Users and roles\n- Least privilege\n- SQL injection prevention\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Backup and Recovery', 'topics': ['Backup types', 'Restore testing', 'Point-in-time recovery concepts'], 'notes': '## Backup and Recovery\n\nThis intermediate lesson in Database Management develops the concepts needed to apply backup and recovery in practical coursework and projects.\n\n### Learning points\n- Backup types\n- Restore testing\n- Point-in-time recovery concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'NoSQL Fundamentals', 'topics': ['Document databases', 'Key-value stores', 'Relational and NoSQL comparison'], 'notes': '## NoSQL Fundamentals\n\nThis intermediate lesson in Database Management develops the concepts needed to apply nosql fundamentals in practical coursework and projects.\n\n### Learning points\n- Document databases\n- Key-value stores\n- Relational and NoSQL comparison\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Data Modeling for Applications', 'topics': ['Schema design', 'Constraints', 'Migrations'], 'notes': '## Data Modeling for Applications\n\nThis intermediate lesson in Database Management develops the concepts needed to apply data modeling for applications in practical coursework and projects.\n\n### Learning points\n- Schema design\n- Constraints\n- Migrations\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Connectivity', 'topics': ['Connection pooling', 'Prepared statements', 'Application transactions'], 'notes': '## Database Connectivity\n\nThis intermediate lesson in Database Management develops the concepts needed to apply database connectivity in practical coursework and projects.\n\n### Learning points\n- Connection pooling\n- Prepared statements\n- Application transactions\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Data Warehousing Basics', 'topics': ['Fact and dimension tables', 'Star schema', 'ETL workflow'], 'notes': '## Data Warehousing Basics\n\nThis intermediate lesson in Database Management develops the concepts needed to apply data warehousing basics in practical coursework and projects.\n\n### Learning points\n- Fact and dimension tables\n- Star schema\n- ETL workflow\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Administration', 'topics': ['Monitoring', 'Capacity planning', 'Maintenance tasks'], 'notes': '## Database Administration\n\nThis intermediate lesson in Database Management develops the concepts needed to apply database administration in practical coursework and projects.\n\n### Learning points\n- Monitoring\n- Capacity planning\n- Maintenance tasks\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Design Project', 'topics': ['Model requirements', 'Implement schema and queries', 'Test performance and integrity'], 'notes': '## Database Design Project\n\nThis intermediate lesson in Database Management develops the concepts needed to apply database design project in practical coursework and projects.\n\n### Learning points\n- Model requirements\n- Implement schema and queries\n- Test performance and integrity\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}, {'id': 18, 'name': 'Database Management', 'title': 'Database Management', 'level': 'Advanced', 'description': 'A structured advanced learning path for Database Management, with 16 lessons, study notes and practical exercises.', 'lesson_list': [{'title': 'Advanced Relational Theory', 'topics': ['Relational algebra', 'Advanced dependencies', 'Schema decomposition'], 'notes': '## Advanced Relational Theory\n\nThis advanced lesson in Database Management develops the concepts needed to apply advanced relational theory in practical coursework and projects.\n\n### Learning points\n- Relational algebra\n- Advanced dependencies\n- Schema decomposition\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Query Optimization Internals', 'topics': ['Cost-based optimization', 'Join algorithms', 'Statistics and cardinality'], 'notes': '## Query Optimization Internals\n\nThis advanced lesson in Database Management develops the concepts needed to apply query optimization internals in practical coursework and projects.\n\n### Learning points\n- Cost-based optimization\n- Join algorithms\n- Statistics and cardinality\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced Indexing', 'topics': ['Composite and covering indexes', 'Partial indexes', 'Partitioned indexes'], 'notes': '## Advanced Indexing\n\nThis advanced lesson in Database Management develops the concepts needed to apply advanced indexing in practical coursework and projects.\n\n### Learning points\n- Composite and covering indexes\n- Partial indexes\n- Partitioned indexes\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Distributed Database Concepts', 'topics': ['Replication', 'Sharding', 'Consistency models'], 'notes': '## Distributed Database Concepts\n\nThis advanced lesson in Database Management develops the concepts needed to apply distributed database concepts in practical coursework and projects.\n\n### Learning points\n- Replication\n- Sharding\n- Consistency models\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Distributed Transactions', 'topics': ['Two-phase commit concepts', 'Saga pattern', 'Failure handling'], 'notes': '## Distributed Transactions\n\nThis advanced lesson in Database Management develops the concepts needed to apply distributed transactions in practical coursework and projects.\n\n### Learning points\n- Two-phase commit concepts\n- Saga pattern\n- Failure handling\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'High Availability', 'topics': ['Failover design', 'Replication lag', 'Recovery objectives'], 'notes': '## High Availability\n\nThis advanced lesson in Database Management develops the concepts needed to apply high availability in practical coursework and projects.\n\n### Learning points\n- Failover design\n- Replication lag\n- Recovery objectives\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Scalability', 'topics': ['Read replicas', 'Horizontal partitioning', 'Workload isolation'], 'notes': '## Database Scalability\n\nThis advanced lesson in Database Management develops the concepts needed to apply database scalability in practical coursework and projects.\n\n### Learning points\n- Read replicas\n- Horizontal partitioning\n- Workload isolation\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Advanced NoSQL Modeling', 'topics': ['Document aggregation', 'Wide-column modeling', 'Graph database patterns'], 'notes': '## Advanced NoSQL Modeling\n\nThis advanced lesson in Database Management develops the concepts needed to apply advanced nosql modeling in practical coursework and projects.\n\n### Learning points\n- Document aggregation\n- Wide-column modeling\n- Graph database patterns\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Streaming Data Systems', 'topics': ['Event logs', 'Change data capture', 'Stream processing concepts'], 'notes': '## Streaming Data Systems\n\nThis advanced lesson in Database Management develops the concepts needed to apply streaming data systems in practical coursework and projects.\n\n### Learning points\n- Event logs\n- Change data capture\n- Stream processing concepts\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Data Warehouse Architecture', 'topics': ['Dimensional modeling', 'Slowly changing dimensions', 'Lakehouse overview'], 'notes': '## Data Warehouse Architecture\n\nThis advanced lesson in Database Management develops the concepts needed to apply data warehouse architecture in practical coursework and projects.\n\n### Learning points\n- Dimensional modeling\n- Slowly changing dimensions\n- Lakehouse overview\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Big Data Query Engines', 'topics': ['Columnar storage', 'Distributed SQL', 'Partition pruning'], 'notes': '## Big Data Query Engines\n\nThis advanced lesson in Database Management develops the concepts needed to apply big data query engines in practical coursework and projects.\n\n### Learning points\n- Columnar storage\n- Distributed SQL\n- Partition pruning\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Database Observability', 'topics': ['Slow query analysis', 'Metrics and tracing', 'Capacity monitoring'], 'notes': '## Database Observability\n\nThis advanced lesson in Database Management develops the concepts needed to apply database observability in practical coursework and projects.\n\n### Learning points\n- Slow query analysis\n- Metrics and tracing\n- Capacity monitoring\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Security and Compliance', 'topics': ['Encryption at rest and transit', 'Auditing', 'Data retention principles'], 'notes': '## Security and Compliance\n\nThis advanced lesson in Database Management develops the concepts needed to apply security and compliance in practical coursework and projects.\n\n### Learning points\n- Encryption at rest and transit\n- Auditing\n- Data retention principles\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Disaster Recovery Planning', 'topics': ['Recovery time objectives', 'Recovery point objectives', 'Restore drills'], 'notes': '## Disaster Recovery Planning\n\nThis advanced lesson in Database Management develops the concepts needed to apply disaster recovery planning in practical coursework and projects.\n\n### Learning points\n- Recovery time objectives\n- Recovery point objectives\n- Restore drills\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Performance Tuning Lab', 'topics': ['Benchmark workloads', 'Diagnose bottlenecks', 'Validate tuning changes'], 'notes': '## Performance Tuning Lab\n\nThis advanced lesson in Database Management develops the concepts needed to apply performance tuning lab in practical coursework and projects.\n\n### Learning points\n- Benchmark workloads\n- Diagnose bottlenecks\n- Validate tuning changes\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}, {'title': 'Capstone: Production Data Platform', 'topics': ['Architecture and data model', 'Implement reliability and security', 'Load test and document operations'], 'notes': '## Capstone: Production Data Platform\n\nThis advanced lesson in Database Management develops the concepts needed to apply capstone: production data platform in practical coursework and projects.\n\n### Learning points\n- Architecture and data model\n- Implement reliability and security\n- Load test and document operations\n\n### How to study this lesson\nReview each topic in order, write a short explanation in your own words, and connect the ideas to a small example. Check assumptions and test your work with more than one case.\n\n### Practice task\nCreate a small exercise using at least two of the topics above. Record your approach, the result, and one improvement you would make.'}]}]

course_data.extend(additional_learning_paths)


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

    content = lesson.get("notes") or (
        f"Welcome to {lesson['title']}.\n\n"
        f"In this lesson, you will learn about {lesson['title']} as part of {course['name']}.\n\n"
        "Study each topic carefully and practise the concepts using examples."
    )

    return {
        "course_id": course_id,
        "course_name": course["name"],
        "level": course.get("level", "Beginner"),
        "total_lessons": len(lesson_list),
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
from io import BytesIO


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class TutorChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    course: str = Field(min_length=1, max_length=160)
    history: List[TutorMessage] = Field(default_factory=list, max_length=12)
    language: Literal["English", "Telugu", "Hindi"] = "English"
    document_context: str = Field(default="", max_length=30000)


def _call_tutor_provider(course: str, message: str, history: list, language: str = "English", document_context: str = ""):
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
            f"Respond in {language}. Keep technical keywords and code syntax in their original form. "
            "Explain concepts step by step, use accurate examples, show code output when useful, "
            "and finish with a short practice question when appropriate. If debugging, explain the cause "
            "and provide corrected code. Do not claim to access private course records or external systems. "
            "If a question is outside the subject, still help safely and clearly. "
            + (f" The student also supplied this PDF text as study context: {document_context[:30000]}" if document_context else "")
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
        [item.model_dump() for item in payload.history],
        payload.language,
        payload.document_context
    )

    return {"reply": reply}




# ============================================================
# WIZIAI SMART TUTOR - PDF NOTES EXTRACTION
# ============================================================

@app.post("/api/tutor-pdf")
async def tutor_pdf(
    file: UploadFile = File(...),
    authorization: str = Header(default=None)
):
    # Require a signed-in Firebase user for every document operation.
    user = get_authenticated_user(authorization)
    if not user.get("uid"):
        raise HTTPException(status_code=401, detail="Authenticated Firebase user ID is missing.")

    filename = (file.filename or "").lower()
    if not filename.endswith(".pdf") or file.content_type not in ("application/pdf", "application/octet-stream", None):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    raw = await file.read(8 * 1024 * 1024 + 1)
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF is too large. Maximum size is 8 MB.")

    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(raw))
        if len(reader.pages) > 30:
            raise HTTPException(status_code=413, detail="PDF has too many pages. Maximum is 30 pages.")
        extracted = "\n".join((page.extract_text() or "") for page in reader.pages)
        extracted = extracted.strip()
        if not extracted:
            raise HTTPException(status_code=422, detail="No selectable text was found. Scanned-image PDFs are not supported yet.")
        return {
            "filename": file.filename or "study-notes.pdf",
            "page_count": len(reader.pages),
            "text": extracted[:30000]
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF. Please check that it is a valid, non-password-protected PDF.")
    finally:
        await file.close()


# ============================================================
# END OF SMARTLEARN AI BACKEND
# ============================================================
