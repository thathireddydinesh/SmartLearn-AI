import { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";

import { auth, db } from "./firebase";
import QRCode from "qrcode";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

import {
  onAuthStateChanged,
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBlob, deleteObject } from "firebase/storage";

const API_URL = "http://127.0.0.1:8000/api";
const COURSES_URL = `${API_URL}/courses`;
const QUIZ_URL = `${API_URL}/generate-quiz`;

const starterFlashcards = [
  {
    front: "What is a variable?",
    back: "A named storage location for a value."
  },
  {
    front: "What does HTML stand for?",
    back: "HyperText Markup Language."
  },
  {
    front: "What is an algorithm?",
    back: "A step-by-step procedure for solving a problem."
  }
];


// FEATURE 19 — PEER LEARNING CHALLENGES (curated practice questions with automatic scoring)
const peerLearningChallenges = [
  {
    id: "python-foundations", title: "Python Foundations Sprint", course: "Python Programming", level: "Beginner", points: 30,
    description: "Test variables, loops and basic Python output.",
    questions: [
      { id: "p1", prompt: "Which symbol is used for a single-line comment in Python?", options: ["//", "#", "<!--", "**"], answer: 1, explanation: "Python uses # to begin a single-line comment." },
      { id: "p2", prompt: "What is the output of print(3 + 2 * 2)?", options: ["10", "7", "14", "9"], answer: 1, explanation: "Multiplication happens before addition, so 3 + 4 = 7." },
      { id: "p3", prompt: "Which loop is commonly used to iterate over a list?", options: ["for", "switch", "repeat-until", "case"], answer: 0, explanation: "A for loop can visit each item in a list." }
    ]
  },
  {
    id: "web-basics", title: "Web Development Quick Challenge", course: "Web Development", level: "Beginner", points: 30,
    description: "Check your understanding of HTML, CSS and JavaScript.",
    questions: [
      { id: "w1", prompt: "Which HTML element creates a hyperlink?", options: ["<link>", "<a>", "<href>", "<url>"], answer: 1, explanation: "The anchor element <a> creates a hyperlink." },
      { id: "w2", prompt: "Which CSS property changes text colour?", options: ["font-style", "background", "color", "text-size"], answer: 2, explanation: "The color property sets the foreground text colour." },
      { id: "w3", prompt: "Which keyword declares a block-scoped variable in JavaScript?", options: ["let", "echo", "define", "dim"], answer: 0, explanation: "let declares a block-scoped variable in JavaScript." }
    ]
  },
  {
    id: "database-basics", title: "Database Essentials Challenge", course: "Database Management", level: "Beginner", points: 30,
    description: "Practise SQL basics, keys and query structure.",
    questions: [
      { id: "d1", prompt: "Which SQL command retrieves data from a table?", options: ["GET", "OPEN", "SELECT", "FETCH ALL"], answer: 2, explanation: "SELECT retrieves rows from one or more tables." },
      { id: "d2", prompt: "What does a primary key do?", options: ["Uniquely identifies each row", "Sorts every column", "Encrypts the table", "Deletes duplicates automatically"], answer: 0, explanation: "A primary key uniquely identifies each record in a table." },
      { id: "d3", prompt: "Which clause filters rows in a SQL query?", options: ["ORDER BY", "WHERE", "GROUP BY", "JOIN"], answer: 1, explanation: "WHERE filters rows based on a condition." }
    ]
  }
];

// Browser-based Python playground. Student code runs in a dedicated Web Worker.
function PythonCodeEditor({ courseType = "python" }) {
  const isAIWorkspace = courseType === "ai";
  const pythonExamples = {
    "Hello World": 'print("Hello, SmartLearn AI!")',
    "Variables and addition": 'a = 10\nb = 20\nprint("Sum:", a + b)',
    "If / else": 'marks = 75\nif marks >= 40:\n    print("Pass")\nelse:\n    print("Try again")',
    "For loop": 'for number in range(1, 6):\n    print(number)',
    "Functions": 'def greet(name):\n    return "Hello, " + name\n\nprint(greet("Student"))',
    "Lists": 'fruits = ["apple", "banana", "mango"]\nfor fruit in fruits:\n    print(fruit)'
  };
  // These are small, transparent AI/ML learning demonstrations. They run with
  // standard Python and do not claim to train or call a production AI model.
  const aiExamples = {
    "Rule-based spam classifier": 'spam_words = ["win", "prize", "claim", "free"]\nmessage = "You have won a free prize".lower()\nmatched = [word for word in spam_words if word in message]\nif matched:\n    print("Prediction: Possible spam")\n    print("Matched words:", ", ".join(matched))\nelse:\n    print("Prediction: Not flagged as spam")',
    "Simple sentiment analysis": 'positive_words = ["good", "great", "excellent", "happy"]\nnegative_words = ["bad", "poor", "sad", "terrible"]\nreview = "The course is excellent and useful".lower()\npositive = sum(word in review for word in positive_words)\nnegative = sum(word in review for word in negative_words)\nif positive > negative:\n    sentiment = "Positive"\nelif negative > positive:\n    sentiment = "Negative"\nelse:\n    sentiment = "Neutral"\nprint("Sentiment:", sentiment)\nprint("Positive matches:", positive, "Negative matches:", negative)',
    "Student score prediction (demo)": 'attendance = 90\npractice_score = 82\n# A simple rule-based estimate for learning; not a trained model.\nif attendance >= 85 and practice_score >= 80:\n    prediction = "Likely to perform well"\nelif attendance >= 70 and practice_score >= 60:\n    prediction = "May need more practice"\nelse:\n    prediction = "Needs additional support"\nprint("Estimated outcome:", prediction)',
    "Recommendation system": 'student_interests = {"Python", "AI", "Math"}\ncourse_tags = {\n    "Intro to Python": {"Python", "Programming"},\n    "AI Foundations": {"AI", "Python", "Math"},\n    "Web Design": {"HTML", "CSS"},\n    "Machine Learning Basics": {"AI", "Math", "Data"}\n}\nscores = []\nfor course, tags in course_tags.items():\n    score = len(student_interests & tags)\n    scores.append((score, course))\nfor score, course in sorted(scores, reverse=True):\n    print(course, "- match score:", score)',
    "Dataset statistics": 'marks = [72, 85, 91, 68, 88, 95]\nmean = sum(marks) / len(marks)\nprint("Number of records:", len(marks))\nprint("Average mark:", round(mean, 2))\nprint("Highest mark:", max(marks))\nprint("Lowest mark:", min(marks))',
    "K-nearest neighbours (tiny demo)": 'points = [(1, "A"), (2, "A"), (7, "B"), (8, "B")]\nnew_point = 3\nk = 3\nnearest = sorted(points, key=lambda item: abs(item[0] - new_point))[:k]\ncounts = {}\nfor distance, label in nearest:\n    counts[label] = counts.get(label, 0) + 1\nprediction = max(counts, key=counts.get)\nprint("Nearest examples:", nearest)\nprint("Predicted class:", prediction)'
  };
  const examples = isAIWorkspace ? aiExamples : pythonExamples;
  const firstExample = Object.keys(examples)[0];
  const programsCollectionName = isAIWorkspace ? "aiPrograms" : "pythonPrograms";
  const storageKey = isAIWorkspace ? "smartlearn-ai-editor-code" : "smartlearn-python-editor-code";
  const [code, setCode] = useState(() => {
    try { return localStorage.getItem(storageKey) || examples[firstExample]; }
    catch { return examples[firstExample]; }
  });
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState("Your program output will appear here.");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Choose an example or write your own Python program.");
  const [selectedExample, setSelectedExample] = useState(firstExample);
  const [programTitle, setProgramTitle] = useState(isAIWorkspace ? "My AI Practice Program" : "My Python Program");
  const [savedPrograms, setSavedPrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [savingProgram, setSavingProgram] = useState(false);

  // Load this signed-in student's saved programs from Firestore.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSavedPrograms([]);
        setProgramsLoading(false);
        return;
      }

      try {
        setProgramsLoading(true);
        const programsRef = collection(db, "users", user.uid, programsCollectionName);
        const snapshot = await getDocs(programsRef);
        const programs = snapshot.docs.map((item) => ({
          ...item.data(),
          // Keep Firestore's real document ID last so a stored field
          // named "id" can never replace the ID used by the Open button.
          id: item.id
        }));
        programs.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
          const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setSavedPrograms(programs);
      } catch (error) {
        console.error("Loading saved Python programs failed:", error);
        setStatus("Could not load saved programs: " + error.message);
      } finally {
        setProgramsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  function clearOutput() {
    setOutput("");
    setStatus("Output cleared.");
  }

  async function saveCode() {
    const user = auth.currentUser;

    if (!user) {
      setStatus("Please sign in before saving your program to Firebase.");
      return;
    }
    if (!code.trim()) {
      setStatus("Please enter some Python code before saving.");
      return;
    }

    try {
      setSavingProgram(true);
      setStatus("Saving your program to Firebase...");
      const programsRef = collection(db, "users", user.uid, programsCollectionName);
      const programData = {
        title: programTitle.trim() || "Untitled Python Program",
        code: code,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const savedDocument = await addDoc(programsRef, programData);
      setSavedPrograms((current) => [
        {
          id: savedDocument.id,
          title: programData.title,
          code: programData.code,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        ...current
      ]);
      setStatus("Program saved successfully to Firebase Firestore!");
    } catch (error) {
      console.error("Firebase Python program save failed:", error);
      setStatus("Firebase save failed: " + (error.message || "Unknown error"));
    } finally {
      setSavingProgram(false);
    }
  }

  async function openSavedProgram(program) {
    const user = auth.currentUser;

    if (!user) {
      setStatus("Please sign in before opening a saved program.");
      return;
    }

    if (!program?.id) {
      setStatus("Could not identify the selected saved program. Refresh the list and try again.");
      return;
    }

    try {
      setStatus("Loading the selected program from Firebase...");
      const selectedProgramRef = doc(
        db,
        "users",
        user.uid,
        programsCollectionName,
        program.id
      );
      const selectedProgramSnapshot = await getDoc(selectedProgramRef);

      if (!selectedProgramSnapshot.exists()) {
        setSavedPrograms((current) =>
          current.filter((item) => item.id !== program.id)
        );
        setStatus("This saved program no longer exists. The list has been refreshed.");
        return;
      }

      const selectedProgram = selectedProgramSnapshot.data();

      if (typeof selectedProgram.code !== "string") {
        setStatus("This saved document does not contain valid Python code.");
        return;
      }

      setProgramTitle(selectedProgram.title || "Untitled Python Program");
      setCode(selectedProgram.code);
      setSelectedExample("custom");
      setInputText("");
      setOutput("Saved program loaded. Click Run Code to execute it.");
      setStatus(`Opened "${selectedProgram.title || "Untitled Python Program"}" from Firebase.`);
    } catch (error) {
      console.error("Opening saved Python program failed:", error);
      setStatus("Could not open the selected program: " + (error.message || "Unknown error"));
    }
  }

  async function deleteSavedProgram(programId) {
    const user = auth.currentUser;
    if (!user) {
      setStatus("Please sign in to delete saved programs.");
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, programsCollectionName, programId));
      setSavedPrograms((current) => current.filter((program) => program.id !== programId));
      setStatus("Program deleted from Firebase.");
    } catch (error) {
      console.error("Firebase Python program delete failed:", error);
      setStatus("Could not delete program: " + (error.message || "Unknown error"));
    }
  }

  function downloadCode() {
    const file = new Blob([code], { type: "text/x-python;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = isAIWorkspace ? "smartlearn-ai-practice.py" : "smartlearn-practice.py";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Python file download started.");
  }

  async function runPython() {
    if (running || !code.trim()) return;

    setRunning(true);
    setOutput("Loading Python runtime...");
    setStatus("Preparing Python in your browser. First load may take a little longer.");

    const workerSource = `
      self.onmessage = async (event) => {
        try {
          importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
          const pyodide = await loadPyodide();

          // Tell the page that startup is complete. The execution timer
          // starts only after the Python runtime has loaded.
          self.postMessage({ stage: "ready" });

          let captured = "";
          const inputLines = String(event.data.input || "").split(String.fromCharCode(10)).map((line) => line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line);
          let inputIndex = 0;

          pyodide.setStdout({
            batched: (text) => { captured += text + "\\n"; }
          });
          pyodide.setStderr({
            batched: (text) => { captured += text + "\\n"; }
          });

          // Pyodide 0.27.7 accepts a synchronous stdin callback that
          // returns one complete line for each Python input() call.
          // Avoid embedding Python source inside this JavaScript template.
          pyodide.setStdin({
            stdin: () => {
              if (inputIndex >= inputLines.length) return null;
              return inputLines[inputIndex++];
            }
          });

          try {
            await pyodide.runPythonAsync(event.data.code);
            self.postMessage({
              output: captured || "Program finished without printed output.",
              ok: true
            });
          } catch (error) {
            self.postMessage({
              output: captured + String(error),
              ok: false
            });
          }
        } catch (error) {
          self.postMessage({ output: String(error), ok: false });
        }
      };
    `;

    let worker;
    let workerUrl;
    let startupTimeoutId;
    let executionTimeoutId;
    let finished = false;

    const cleanup = () => {
      if (startupTimeoutId) window.clearTimeout(startupTimeoutId);
      if (executionTimeoutId) window.clearTimeout(executionTimeoutId);
      if (worker) worker.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    };

    const finish = (message, messageStatus) => {
      if (finished) return;
      finished = true;
      cleanup();
      setOutput(message);
      setStatus(messageStatus);
      setRunning(false);
    };

    try {
      workerUrl = URL.createObjectURL(
        new Blob([workerSource], { type: "text/javascript" })
      );
      worker = new Worker(workerUrl);

      // Allow up to 60 seconds for the first Pyodide download/startup.
      startupTimeoutId = window.setTimeout(() => {
        finish(
          "Python could not finish loading. Check your internet connection and try again.",
          "Python runtime loading timed out."
        );
      }, 60000);

      worker.onmessage = (event) => {
        if (event.data?.stage === "ready") {
          if (startupTimeoutId) {
            window.clearTimeout(startupTimeoutId);
            startupTimeoutId = null;
          }

          setOutput("Python is ready. Running your program...");
          setStatus("Python loaded. Executing your code...");

          // Keep a separate limit for student code, so a long-running
          // loop cannot leave the editor stuck.
          executionTimeoutId = window.setTimeout(() => {
            finish(
              "Execution stopped because it took too long. Check for a long-running loop and try again.",
              "Execution timed out."
            );
          }, 12000);

          return;
        }

        finish(
          event.data?.output ?? "No output was returned.",
          event.data?.ok
            ? "Program completed successfully."
            : "Python reported an error. Check the output."
        );
      };

      worker.onerror = (event) => {
        finish(
          event.message || "Could not start Python. Check your internet connection and try again.",
          "Python could not start."
        );
      };

      worker.postMessage({ code, input: inputText });
    } catch (error) {
      finish(
        error.message || "Unable to start the code editor.",
        "Python could not start."
      );
    }
  }

  function resetCode() {
    setCode(examples[firstExample]);
    setInputText("");
    setOutput("Your program output will appear here.");
    setStatus(`${firstExample} example restored.`);
    setSelectedExample("Hello World");
  }

  const panelStyle = { background: "#ffffff", border: "1px solid #dce6ee", borderRadius: 16, padding: 24, margin: "24px 0", boxShadow: "0 8px 24px rgba(16,35,63,0.05)" };
  const buttonStyle = { border: 0, borderRadius: 9, padding: "11px 18px", fontWeight: 700, cursor: "pointer", background: "#139b91", color: "white" };
  const secondaryStyle = { ...buttonStyle, background: "#e8eef4", color: "#18334f" };
  const fieldStyle = { boxSizing: "border-box", width: "100%", padding: 12, borderRadius: 9, border: "1px solid #cbd5e1", fontFamily: "inherit", fontSize: 14 };

  return (
    <section style={panelStyle} aria-label="Python code editor">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ color: "#139b91", fontWeight: 700, margin: "0 0 6px" }}>HANDS-ON PRACTICE</p>
          <h3 style={{ color: "#18334f", margin: 0 }}>{isAIWorkspace ? "AI & Machine Learning Python Lab" : "Python Code Editor"}</h3>
        </div>
        <span style={{ color: "#64748b", fontSize: 13 }}>Runs in your browser</span>
      </div>
      <p style={{ color: "#526174", lineHeight: 1.6 }}>{isAIWorkspace ? "Explore beginner-friendly AI concepts using runnable Python demonstrations: text classification, sentiment analysis, recommendations, simple prediction rules and data analysis. These examples are educational simulations, not trained production models." : "Choose a sample, edit the code, provide input if needed, and run it. Code executes in a browser worker and is not sent to the SmartLearn API."}</p>

      <label htmlFor={isAIWorkspace ? "smartlearn-ai-title" : "smartlearn-python-title"} style={{ display: "block", fontWeight: 700, color: "#18334f", marginBottom: 8 }}>Program title</label>
      <input id={isAIWorkspace ? "smartlearn-ai-title" : "smartlearn-python-title"} value={programTitle} onChange={(event) => setProgramTitle(event.target.value)} placeholder="Enter a program title" style={{ ...fieldStyle, marginBottom: 14 }} />

      <label htmlFor={isAIWorkspace ? "smartlearn-ai-example" : "smartlearn-python-example"} style={{ display: "block", fontWeight: 700, color: "#18334f", marginBottom: 8 }}>Practice examples</label>
      <select id={isAIWorkspace ? "smartlearn-ai-example" : "smartlearn-python-example"} value={selectedExample} onChange={(event) => { const name = event.target.value; setSelectedExample(name); setCode(examples[name]); setOutput("Example loaded. Select Run Code to execute it."); setStatus(`${name} example loaded.`); }} style={{ ...fieldStyle, marginBottom: 14 }}>
        {Object.keys(examples).map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="custom" disabled>Custom code (edit below)</option>
      </select>

      <label htmlFor={isAIWorkspace ? "smartlearn-ai-code" : "smartlearn-python-code"} style={{ display: "block", fontWeight: 700, color: "#18334f", marginBottom: 8 }}>Your Python program</label>
      <textarea id={isAIWorkspace ? "smartlearn-ai-code" : "smartlearn-python-code"} spellCheck={false} value={code} onChange={(event) => { setCode(event.target.value); setSelectedExample("custom"); }} aria-label={isAIWorkspace ? "AI practice Python code input" : "Python code input"} style={{ boxSizing: "border-box", width: "100%", minHeight: 240, resize: "vertical", padding: 16, borderRadius: 10, border: "1px solid #263e5b", background: "#10233f", color: "#e7f5f5", fontFamily: "Consolas, monospace", fontSize: 14, lineHeight: 1.7, outlineOffset: 2 }} />

      <label htmlFor={isAIWorkspace ? "smartlearn-ai-input" : "smartlearn-python-input"} style={{ display: "block", fontWeight: 700, color: "#18334f", margin: "16px 0 8px" }}>Program input (one value per line)</label>
      <textarea id={isAIWorkspace ? "smartlearn-ai-input" : "smartlearn-python-input"} value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder={'Example for input():\nDinesh\n20'} rows={3} style={{ ...fieldStyle, fontFamily: "Consolas, monospace" }} />
      <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>For programs using input(), enter the responses above in the same order as the input() calls.</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0" }}>
        <button type="button" style={{ ...buttonStyle, opacity: running ? 0.65 : 1 }} onClick={runPython} disabled={running || !code.trim()}>{running ? "Running Python..." : "▶ Run Code"}</button>
        <button type="button" onClick={clearOutput} disabled={running} style={secondaryStyle}>Clear Output</button>
        <button type="button" onClick={saveCode} disabled={running || savingProgram || !code.trim()} style={secondaryStyle}>{savingProgram ? "Saving to Firebase..." : "Save My Code"}</button>
        <button type="button" onClick={downloadCode} disabled={running || !code.trim()} style={secondaryStyle}>Download .py</button>
        <button type="button" onClick={resetCode} disabled={running} style={secondaryStyle}>Reset Example</button>
      </div>

      <div role="status" aria-live="polite" style={{ color: "#526174", fontSize: 13, marginBottom: 8 }}>{status}</div>
      <h4 style={{ color: "#18334f", margin: "12px 0 8px" }}>Output</h4>
      <pre style={{ boxSizing: "border-box", minHeight: 90, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "#0b1728", color: "#b9f3dc", padding: 16, borderRadius: 10, fontFamily: "Consolas, monospace", lineHeight: 1.6 }}>{output}</pre>
      <section style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #dce6ee" }}>
        <h4 style={{ color: "#18334f", margin: "0 0 10px" }}>{isAIWorkspace ? "My Saved AI Programs (Firebase)" : "My Saved Programs (Firebase)"}</h4>
        {programsLoading ? (
          <p style={{ color: "#64748b" }}>Loading your saved programs...</p>
        ) : !auth.currentUser ? (
          <p style={{ color: "#64748b" }}>Sign in to save and view programs in Firebase.</p>
        ) : savedPrograms.length === 0 ? (
          <p style={{ color: "#64748b" }}>No programs saved yet. Enter a title and code, then click Save My Code.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {savedPrograms.map((program) => (
              <div key={program.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 12, border: "1px solid #dce6ee", borderRadius: 10 }}>
                <strong style={{ color: "#18334f" }}>{program.title || "Untitled Python Program"}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => openSavedProgram(program)} style={secondaryStyle}>Open</button>
                  <button type="button" onClick={() => deleteSavedProgram(program.id)} style={{ ...secondaryStyle, color: "#b42318" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5, marginBottom: 0 }}>Programs are saved to your signed-in account in Firebase Firestore. Download a .py copy to keep a separate backup. The Python runtime loads from the internet the first time. Programs have a time limit; extra package installation is not configured.</p>
    </section>
  );
}


// Course-specific practice tools displayed beneath each course's lesson list.
function CoursePracticeWorkspace({ course }) {
  const name = (course?.name || course?.title || '').toLowerCase();
  const [programTitle, setProgramTitle] = useState('My Course Practice');
  const [selectedExample, setSelectedExample] = useState(name.includes('database') ? 'Select all students' : name.includes('data structure') ? 'Stack (LIFO)' : 'Hello World');
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState('Your practice output will appear here.');
  const [status, setStatus] = useState('Choose an example, edit it and practise.');
  const [saving, setSaving] = useState(false);
  const [javaRunning, setJavaRunning] = useState(false);

  const [javaCode, setJavaCode] = useState('public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, SmartLearn AI!");\n    }\n}');
  const [webHtml, setWebHtml] = useState('<h1>Welcome to SmartLearn AI</h1>\n<p>My first web page.</p>\n<button id="helloButton">Click Me</button>');
  const [webCss, setWebCss] = useState('body {\n  background: #eef7f6;\n  font-family: Arial, sans-serif;\n  text-align: center;\n  padding: 30px;\n}\nh1 { color: teal; }\nbutton { padding: 12px 20px; background: teal; color: white; border: 0; border-radius: 6px; cursor: pointer; }');
  const [webJs, setWebJs] = useState("document.getElementById('helloButton').addEventListener('click', function () {\n  alert('Welcome to SmartLearn AI!');\n});");
  const [activeWebTab, setActiveWebTab] = useState('HTML');
  const [sqlCode, setSqlCode] = useState('SELECT * FROM students;');
  const [sqlRows, setSqlRows] = useState([{id:1,name:'Anaya',marks:85,course:'Python'},{id:2,name:'Ravi',marks:72,course:'Java'},{id:3,name:'Meera',marks:91,course:'Python'},{id:4,name:'Arjun',marks:68,course:'Web Development'}]);
  const [stack, setStack] = useState(['10', '20']);
  const [queue, setQueue] = useState(['A', 'B']);
  const [linkedList, setLinkedList] = useState(['10', '20', '30']);
  const [dsArray, setDsArray] = useState([8, 3, 6, 1, 9]);
  const [searchTarget, setSearchTarget] = useState('6');
  const [item, setItem] = useState('');
  const [dsLog, setDsLog] = useState('Try an operation to see what happens.');
  const [previewCode, setPreviewCode] = useState('');
  const [practiceNotes, setPracticeNotes] = useState('Stack: Last In, First Out (LIFO)\n1. Push 30\n2. Push 40\n3. Pop');
  const [javaCodeCheck, setJavaCodeCheck] = useState('');

  const panelStyle = { marginTop: 28, padding: 22, border: '1px solid #dce5ee', borderRadius: 16, background: '#fff' };
  const editorStyle = { boxSizing: 'border-box', width: '100%', minHeight: 230, padding: 16, borderRadius: 10, border: '1px solid #263e5b', background: '#10233f', color: '#e7f5f5', fontFamily: 'Consolas, monospace', fontSize: 14, lineHeight: 1.7, resize: 'vertical' };
  const fieldStyle = { boxSizing: 'border-box', width: '100%', padding: 12, borderRadius: 9, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14 };
  const buttonStyle = { border: 0, borderRadius: 9, padding: '11px 18px', fontWeight: 700, cursor: 'pointer', background: '#139b91', color: 'white', margin: '8px 8px 0 0' };
  const secondaryStyle = { ...buttonStyle, background: '#e8eef4', color: '#18334f' };

  const isPython = name.includes('python');
  const isAI = name.includes('artificial intelligence') || name === 'ai';
  const isJava = name.includes('java');
  const isWeb = name.includes('web');
  const isDS = name.includes('data structure');
  const isDatabase = name.includes('database');

  let title = 'Course Practice Workspace';
  let description = 'Practise the lesson with examples, an editor, input, saved work and an output area.';
  let language = 'txt';
  let code = '';
  let examples = {};

  if (isJava) {
    title = 'Java Code Editor'; language = 'java'; code = javaCode;
    examples = {
      'Hello World': 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, SmartLearn AI!");\n    }\n}',
      'Variables': 'public class Main {\n    public static void main(String[] args) {\n        int age = 20;\n        String name = "Student";\n        System.out.println(name + " is " + age);\n    }\n}',
      'If / else': 'public class Main {\n    public static void main(String[] args) {\n        int marks = 75;\n        if (marks >= 40) {\n            System.out.println("Pass");\n        } else {\n            System.out.println("Try again");\n        }\n    }\n}',
      'For loop': 'public class Main {\n    public static void main(String[] args) {\n        for (int i = 1; i <= 5; i++) {\n            System.out.println(i);\n        }\n    }\n}'
    };
    description = 'Write Java programs, provide input, compile and run them with your local Java JDK, save your work and download .java files.';
  } else if (isWeb) {
    title = 'Web Development Code Editor'; language = 'html';
    examples = {
      'Hello World': {
        html: '<h1>Hello, SmartLearn AI!</h1>\n<p>My first web page.</p>',
        css: 'body { font-family: Arial, sans-serif; padding: 24px; }\nh1 { color: teal; }',
        js: `console.log('Hello from JavaScript!');`
      },
      'Profile Card': {
        html: '<main class="card">\n  <h1>My Profile</h1>\n  <p>Name: Student</p>\n  <button id="profileButton">Say Hello</button>\n</main>',
        css: 'body { font-family: Arial, sans-serif; background: #eef7f6; padding: 24px; }\n.card { max-width: 320px; margin: 30px auto; padding: 24px; background: white; border-radius: 12px; text-align: center; }\nbutton { background: teal; color: white; padding: 10px 16px; border: 0; border-radius: 6px; }',
        js: `document.getElementById('profileButton').addEventListener('click', () => alert('Hello, student!'));`
      },
      'Simple Styling': {
        html: '<h1>Styled Page</h1>\n<p>Change the CSS to practise.</p>',
        css: 'body { font-family: Arial; background: #eef7f6; text-align: center; padding: 30px; }\nh1 { color: teal; }',
        js: `console.log('Page loaded');`
      }
    };
    description = 'Write HTML, CSS and JavaScript, run your page in a live preview, save your project and download an .html file.';
  } else if (isDatabase) {
    title = 'SQL Code Editor'; language = 'sql'; code = sqlCode;
    examples = {
      'Select all students': 'SELECT * FROM students;',
      'Show names only': 'SELECT name FROM students;',
      'Filter marks': 'SELECT name, marks FROM students WHERE marks >= 80;',
      'Sort students': 'SELECT name, marks FROM students ORDER BY marks DESC;',
      'Find Python students': "SELECT name, course FROM students WHERE course = 'Python';",
      'Count students': 'SELECT COUNT(*) AS total_students FROM students;',
      'Insert a student': "INSERT INTO students (id, name, marks, course) VALUES (5, 'Dinesh', 88, 'Java');",
      'Update marks': 'UPDATE students SET marks = 95 WHERE id = 2;',
      'Delete a student': 'DELETE FROM students WHERE id = 4;'
    };
    description = 'Learn SQL by running SELECT, WHERE, ORDER BY, COUNT, INSERT, UPDATE and DELETE queries against an editable sample students table. This simulator does not change your Firebase data.';
  } else if (isDS) {
    title = 'Data Structures Practice Editor'; language = 'txt'; code = 'Stack: Last In, First Out (LIFO)\n1. Push 30\n2. Push 40\n3. Pop';
    examples = {
      'Stack (LIFO)': 'Stack: Last In, First Out (LIFO)\n1. Push 30\n2. Push 40\n3. Pop',
      'Queue (FIFO)': 'Queue: First In, First Out (FIFO)\n1. Enqueue A\n2. Enqueue B\n3. Dequeue',
      'Linear Search': 'Algorithm: Linear Search\nFind target 7 in [3, 5, 7, 9]\nCheck each element from left to right.',
      'Binary Search': 'Algorithm: Binary Search\nSorted list: [2, 4, 6, 8, 10]\nFind target 8 by checking the middle element.'
    };
    description = 'Choose a data-structure example, study the steps, run Stack and Queue operations, save your notes and download them.';
  } else if (isAI) {
    title = 'AI & Machine Learning Python Editor'; language = 'py'; code = '';
    examples = {};
    description = 'Practise AI concepts with Python examples, input, browser-based execution, saved programs and output.';
  }

  if (isPython || isAI) {
    return <section style={panelStyle} aria-label="Python practice workspace">
      <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><p style={{color:'#139b91',fontWeight:700,margin:'0 0 6px'}}>HANDS-ON PRACTICE</p><h3 style={{color:'#18334f',margin:0}}>{isAI ? 'AI & Machine Learning Python Editor' : 'Python Code Editor'}</h3></div><span style={{color:'#64748b'}}>Runs in your browser</span></div>
      <p style={{color:'#526174',lineHeight:1.6}}>Choose a sample, edit the code, provide input if needed, and run it. Save and download your programs.</p>
      <PythonCodeEditor courseType={isAI ? "ai" : "python"} />
    </section>;
  }

  const loadExample = (exampleName) => {
    setSelectedExample(exampleName);
    if (isJava) setJavaCode(examples[exampleName]);
    if (isWeb) { setWebHtml(examples[exampleName].html); setWebCss(examples[exampleName].css); setWebJs(examples[exampleName].js); setActiveWebTab('HTML'); }
    if (isDatabase) setSqlCode(examples[exampleName]);
    if (isDS) setPracticeNotes(examples[exampleName]);
    setStatus(`${exampleName} example loaded.`);
    if (isWeb) setPreviewCode('');
  };

  const buildWebDocument = () => {
    // Always build a complete document so CSS is placed in <head>, never
    // accidentally rendered as visible text in the preview.
    const source = webHtml.trim();
    const headMatch = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let headContent = headMatch ? headMatch[1] : '';
    let bodyContent = bodyMatch ? bodyMatch[1] : source;

    if (!bodyMatch) {
      bodyContent = bodyContent
        .replace(/<!doctype[^>]*>/i, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/i, '')
        .trim();
    }

    const safeCss = webCss.replace(/<\/style/gi, '<\\/style');
    const safeJs = webJs.replace(/<\/script/gi, '<\\/script');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${headContent}
<style>
${safeCss}
</style>
</head>
<body>
${bodyContent}
<script>
${safeJs}
<\/script>
</body>
</html>`;
  };
  const getCurrentCode = () => isJava ? javaCode : isWeb ? buildWebDocument() : isDatabase ? sqlCode : practiceNotes;
  const setCurrentCode = (value) => {
    if (isJava) setJavaCode(value);
    if (isDatabase) setSqlCode(value);
    if (isDS) setPracticeNotes(value);
  };

  async function saveWorkspace() {
    const user = auth.currentUser;
    if (!user) { setStatus('Please sign in before saving your course work to Firebase.'); return; }
    try {
      setSaving(true);
      await addDoc(collection(db, 'users', user.uid, 'coursePrograms'), {
        courseName: course?.name || course?.title || title,
        language,
        title: programTitle.trim() || `Untitled ${language.toUpperCase()} Practice`,
        code: getCurrentCode(),
        ...(isWeb ? { projectFiles: { html: webHtml, css: webCss, javascript: webJs } } : {}),
        ...(isDS ? { dataStructureState: { stack, queue, linkedList, array: dsArray, searchTarget, notes: practiceNotes, activityLog: dsLog } } : {}),
        ...(isDatabase ? { sampleTable: sqlRows } : {}),
        input: inputText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setStatus('Your course work was saved to Firebase Firestore.');
    } catch (error) {
      console.error('Saving course practice failed:', error);
      setStatus(`Could not save your work: ${error.message || 'Unknown error'}`);
    } finally { setSaving(false); }
  }

  function downloadWorkspace() {
    const extensions = {java:'java',html:'html',sql:'sql',txt:'txt'};
    const exportContent = isDS ? `${getCurrentCode()}\n\nCurrent practice state\nStack: ${stack.join(', ')}\nQueue: ${queue.join(', ')}\nLinked List: ${linkedList.join(' -> ')}\nArray: ${dsArray.join(', ')}\nSearch Target: ${searchTarget}\nActivity: ${dsLog}\n` : getCurrentCode();
    const blob = new Blob([exportContent], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(programTitle.trim() || 'smartlearn-practice').replace(/[^a-z0-9-_]/gi,'_')}.${extensions[language] || 'txt'}`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setStatus('Your practice file download has started.');
  }

  function downloadWebProject() {
    const base = (programTitle.trim() || 'smartlearn-web-project').replace(/[^a-z0-9-_]/gi, '_');
    const files = [
      { name: `${base}.html`, content: webHtml },
      { name: `${base}.css`, content: webCss },
      { name: `${base}.js`, content: webJs }
    ];
    files.forEach((file, index) => {
      const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000 + index * 300);
    });
    setStatus('HTML, CSS and JavaScript project files are downloading.');
  }

  async function runPractice() {
    if (isJava) {
      if (!javaCode.trim()) {
        setOutput('Please enter Java code before running.');
        setStatus('Java code is empty.');
        return;
      }
      try {
        setJavaRunning(true);
        setStatus('Compiling and running Java program...');
        setOutput('Please wait...');
        const response = await fetch('http://127.0.0.1:8000/api/java/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: javaCode, input: inputText })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.detail || `Java service returned HTTP ${response.status}.`);
        }
        setOutput(result.output || 'No output returned.');
        setStatus(result.success ? 'Java compiled and executed successfully.' : `Java ${result.stage || 'execution'} failed. Check the output below.`);
      } catch (error) {
        setOutput(error.message || 'Could not connect to the Java runner.');
        setStatus('Java runner connection failed. Make sure the FastAPI backend is running.');
      } finally {
        setJavaRunning(false);
      }
      return;
    }
    if (isWeb) {
      setPreviewCode(buildWebDocument());
      setOutput('Preview updated successfully.');
      setStatus('Web page preview is running below.');
      return;
    }
    if (isDatabase) {
      const query = sqlCode.trim().replace(/;\s*$/, '');
      const rows = sqlRows.map(row => ({ ...row }));
      const parseValue = raw => {
        const value = raw.trim();
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) return value.slice(1, -1);
        if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
        return value;
      };
      const formatRows = (items, columns) => {
        if (!items.length) return 'Query completed. No rows found.';
        const widths = columns.map(col => Math.max(col.length, ...items.map(row => String(row[col] ?? '').length)));
        const line = values => values.map((value, i) => String(value ?? '').padEnd(widths[i])).join(' | ');
        return [line(columns), widths.map(width => '-'.repeat(width)).join('-+-'), ...items.map(row => line(columns.map(col => row[col])))].join('\n') + `\n\n${items.length} row(s) returned.`;
      };
      try {
        let match;
        if ((match = query.match(/^SELECT\s+(.+?)\s+FROM\s+students(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i))) {
          const fields = match[1].trim(), where = match[2], orderField = match[3], direction = (match[4] || 'ASC').toUpperCase();
          let resultRows = rows;
          if (where) {
            const condition = where.match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/);
            if (!condition) throw new Error('Use WHERE column = value, >, <, >= or <=.');
            const [, field, operator, raw] = condition, expected = parseValue(raw);
            if (!['id','name','marks','course'].includes(field)) throw new Error(`Unknown column: ${field}`);
            resultRows = resultRows.filter(row => {
              const actual = row[field];
              if (operator === '=') return String(actual).toLowerCase() === String(expected).toLowerCase();
              if (operator === '!=' || operator === '<>') return String(actual).toLowerCase() !== String(expected).toLowerCase();
              if (operator === '>') return actual > expected;
              if (operator === '<') return actual < expected;
              if (operator === '>=') return actual >= expected;
              return actual <= expected;
            });
          }
          if (orderField) {
            if (!['id','name','marks','course'].includes(orderField)) throw new Error(`Unknown ORDER BY column: ${orderField}`);
            resultRows = [...resultRows].sort((a,b) => typeof a[orderField] === 'number' ? a[orderField]-b[orderField] : String(a[orderField]).localeCompare(String(b[orderField])));
            if (direction === 'DESC') resultRows.reverse();
          }
          if (match[5]) resultRows = resultRows.slice(0, Number(match[5]));
          if (/^COUNT\s*\(\s*\*\s*\)/i.test(fields)) {
            const alias = (fields.match(/\s+AS\s+(\w+)/i) || [])[1] || 'COUNT(*)';
            setOutput(formatRows([{[alias]:resultRows.length}], [alias]));
          } else {
            const columns = fields === '*' ? ['id','name','marks','course'] : fields.split(',').map(v=>v.trim());
            if (columns.some(col=>!['id','name','marks','course'].includes(col))) throw new Error('Available columns: id, name, marks, course.');
            setOutput(formatRows(resultRows, columns));
          }
          setStatus('SELECT query executed successfully.'); return;
        }
        if ((match = query.match(/^INSERT\s+INTO\s+students\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i))) {
          const columns = match[1].split(',').map(v=>v.trim().toLowerCase());
          const values = match[2].split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map(parseValue);
          if (columns.length !== values.length || columns.some(c=>!['id','name','marks','course'].includes(c))) throw new Error('Use matching id, name, marks and course columns and values.');
          const row = {id:null,name:'',marks:0,course:''}; columns.forEach((col,i)=>row[col]=values[i]);
          if (!row.id || !row.name || rows.some(item=>item.id===row.id)) throw new Error('Provide a name and a unique student ID.');
          setSqlRows([...rows,row]); setOutput(`1 row inserted.\n\n${formatRows([row],['id','name','marks','course'])}`); setStatus('INSERT query completed.'); return;
        }
        if ((match = query.match(/^UPDATE\s+students\s+SET\s+(\w+)\s*=\s*(.+?)\s+WHERE\s+(\w+)\s*=\s*(.+)$/i))) {
          const [,setField,setRaw,whereField,whereRaw] = match;
          if (!['id','name','marks','course'].includes(setField) || !['id','name','marks','course'].includes(whereField)) throw new Error('Available columns: id, name, marks, course.');
          const setValue=parseValue(setRaw), whereValue=parseValue(whereRaw);
          const updated=rows.map(row=>String(row[whereField])===String(whereValue)?{...row,[setField]:setValue}:row);
          const count=updated.filter((row,i)=>row[setField]!==rows[i][setField]).length;
          setSqlRows(updated); setOutput(`${count} row(s) updated.`); setStatus('UPDATE query completed.'); return;
        }
        if ((match = query.match(/^DELETE\s+FROM\s+students\s+WHERE\s+(\w+)\s*=\s*(.+)$/i))) {
          const [,field,raw]=match; if(!['id','name','marks','course'].includes(field)) throw new Error(`Unknown column: ${field}`);
          const value=parseValue(raw), filtered=rows.filter(row=>String(row[field])!==String(value));
          const count=rows.length-filtered.length; setSqlRows(filtered); setOutput(`${count} row(s) deleted.`); setStatus('DELETE query completed.'); return;
        }
        throw new Error('Supported commands: SELECT, INSERT, UPDATE and DELETE. Choose an example to get started.');
      } catch (error) { setOutput(`SQL Error: ${error.message}`); setStatus('Please correct your SQL query.'); }
      return;
    }
    if (isDS) {
      setOutput('Use the Stack and Queue controls below to run operations. Your current practice notes are shown in the editor.');
      setStatus('Data-structure activity is ready.');
    }
  }

  function resetWorkspace() {
    const first = Object.keys(examples)[0];
    if (isJava) setJavaCode(examples[first]);
    if (isWeb) { setWebHtml(examples[first].html); setWebCss(examples[first].css); setWebJs(examples[first].js); setActiveWebTab('HTML'); setPreviewCode(''); }
    if (isDatabase) { setSqlCode(examples[first]); setSqlRows([{id:1,name:'Anaya',marks:85,course:'Python'},{id:2,name:'Ravi',marks:72,course:'Java'},{id:3,name:'Meera',marks:91,course:'Python'},{id:4,name:'Arjun',marks:68,course:'Web Development'}]); }
    if (isDS) setPracticeNotes(examples[first]);
    setInputText(''); setSelectedExample(first);
    setOutput(isDS ? examples[first] : 'Your practice output will appear here.');
    setStatus(`${first} example restored.`);
  }

  return <section style={panelStyle} aria-label={`${title} workspace`}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><p style={{color:'#139b91',fontWeight:700,margin:'0 0 6px'}}>HANDS-ON PRACTICE</p><h3 style={{color:'#18334f',margin:0}}>{title}</h3></div><span style={{color:'#64748b',fontSize:13}}>{isWeb ? 'Live browser preview' : isJava ? 'Java JDK compiler and runner' : isDatabase ? 'Sample SQL simulator' : 'Interactive practice'}</span></div>
    <p style={{color:'#526174',lineHeight:1.6}}>{description}</p>
    <label style={{display:'block',fontWeight:700,color:'#18334f',marginBottom:8}}>Program title</label>
    <input value={programTitle} onChange={e=>setProgramTitle(e.target.value)} placeholder="Enter a program title" style={{...fieldStyle,marginBottom:14}} />
    <label style={{display:'block',fontWeight:700,color:'#18334f',marginBottom:8}}>Practice examples</label>
    <select value={selectedExample} onChange={e=>loadExample(e.target.value)} style={{...fieldStyle,marginBottom:14}}>{Object.keys(examples).map(k=><option key={k}>{k}</option>)}</select>
    {isWeb ? <>
      <label style={{display:'block',fontWeight:700,color:'#18334f',marginBottom:8}}>Your web project code</label>
      <div role="tablist" aria-label="Web code editors" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
        {['HTML','CSS','JavaScript'].map(tab => <button key={tab} type="button" role="tab" aria-selected={activeWebTab===tab} onClick={()=>setActiveWebTab(tab)} style={{...secondaryStyle,background:activeWebTab===tab?'#139b91':'#e8eef4',color:activeWebTab===tab?'white':'#18334f'}}>{tab}</button>)}
      </div>
      <textarea spellCheck={false} value={activeWebTab==='HTML'?webHtml:activeWebTab==='CSS'?webCss:webJs} onChange={e=>activeWebTab==='HTML'?setWebHtml(e.target.value):activeWebTab==='CSS'?setWebCss(e.target.value):setWebJs(e.target.value)} style={editorStyle} aria-label={`${activeWebTab} editor`} />
      <p style={{color:'#64748b',fontSize:12,marginTop:6}}>Edit each language in its own tab. Run Preview combines HTML, CSS and JavaScript into one page.</p>
    </> : <>
      <label style={{display:'block',fontWeight:700,color:'#18334f',marginBottom:8}}>{isJava?'Your Java program':isDatabase?'Your SQL query':'Your practice notes'}</label>
      <textarea spellCheck={false} value={getCurrentCode()} onChange={e=>setCurrentCode(e.target.value)} style={editorStyle} aria-label={`${language} practice editor`} />
    </>}
    <label style={{display:'block',fontWeight:700,color:'#18334f',margin:'16px 0 8px'}}>Program input (one value per line, if needed)</label>
    <textarea value={inputText} onChange={e=>setInputText(e.target.value)} placeholder={'Enter input values here, one per line.'} rows={3} style={{...fieldStyle,fontFamily:'Consolas,monospace'}} />
    <p style={{color:'#64748b',fontSize:12,marginTop:6}}>{isJava ? 'Enter one input value per line. Your Java program can read these values using Scanner.' : isWeb ? 'HTML preview does not require separate program input.' : isDatabase ? 'The sample SQL simulator uses its built-in students table.' : 'Use the controls below to observe Stack and Queue operations.'}</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}>
      <button type="button" style={buttonStyle} onClick={runPractice}>{isJava ? (javaRunning ? 'Running Java...' : '▶ Run Java Code') : isWeb ? '▶ Run Preview' : isDatabase ? '▶ Run Query' : '▶ Run Activity'}</button>
      <button type="button" style={secondaryStyle} onClick={()=>{setOutput('Output cleared.');setStatus('Output cleared.');}}>Clear Output</button>
      <button type="button" style={secondaryStyle} onClick={saveWorkspace} disabled={saving}>{saving?'Saving...':'Save My Code'}</button>
      {isWeb ? <button type="button" style={secondaryStyle} onClick={downloadWebProject}>Download Project Files</button> : <button type="button" style={secondaryStyle} onClick={downloadWorkspace}>Download .{language}</button>}
      <button type="button" style={secondaryStyle} onClick={resetWorkspace}>Reset Example</button>
    </div>
    {isDS && <div style={{margin:'18px 0',padding:16,border:'1px solid #dce5ee',borderRadius:12,background:'#fbfdff'}}>
      <h4 style={{marginTop:0,color:'#18334f'}}>Interactive Data Structures Lab</h4>
      <p style={{color:'#64748b',fontSize:13,marginTop:-4}}>Try each operation and watch the data structure change. These are interactive learning simulations.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14}}>
        <div style={{padding:14,border:'1px solid #dce5ee',borderRadius:10,background:'#fff'}}>
          <strong>1. Stack — LIFO</strong><p style={{fontSize:12,color:'#64748b'}}>Last In, First Out</p>
          <div style={{minHeight:48,padding:8,background:'#f1f5f9',borderRadius:8,margin:'8px 0'}}>{stack.length ? stack.slice().reverse().map((v,i)=><span key={`${v}-${i}`} style={{display:'inline-block',padding:'6px 9px',margin:3,background:'#d9f3ef',borderRadius:6,fontWeight:700}}>{v}{i===0?' (TOP)':''}</span>) : 'Stack is empty'}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" style={buttonStyle} onClick={()=>{if(item.trim()){setStack(v=>[...v,item.trim()]);setDsLog(`Pushed ${item.trim()} onto the stack.`);setItem('');}}}>Push</button><button type="button" style={secondaryStyle} disabled={!stack.length} onClick={()=>{const v=stack[stack.length-1];setStack(a=>a.slice(0,-1));setDsLog(`Popped ${v} from the stack.`);}}>Pop</button><button type="button" style={secondaryStyle} disabled={!stack.length} onClick={()=>setDsLog(`Stack top is ${stack[stack.length-1]}.`)}>Peek</button></div>
        </div>
        <div style={{padding:14,border:'1px solid #dce5ee',borderRadius:10,background:'#fff'}}>
          <strong>2. Queue — FIFO</strong><p style={{fontSize:12,color:'#64748b'}}>First In, First Out</p>
          <div style={{minHeight:48,padding:8,background:'#f1f5f9',borderRadius:8,margin:'8px 0'}}>{queue.length ? queue.map((v,i)=><span key={`${v}-${i}`} style={{display:'inline-block',padding:'6px 9px',margin:3,background:'#e0eaff',borderRadius:6,fontWeight:700}}>{v}{i===0?' (FRONT)':''}</span>) : 'Queue is empty'}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" style={buttonStyle} onClick={()=>{if(item.trim()){setQueue(v=>[...v,item.trim()]);setDsLog(`Enqueued ${item.trim()}.`);setItem('');}}}>Enqueue</button><button type="button" style={secondaryStyle} disabled={!queue.length} onClick={()=>{const v=queue[0];setQueue(a=>a.slice(1));setDsLog(`Dequeued ${v}.`);}}>Dequeue</button><button type="button" style={secondaryStyle} disabled={!queue.length} onClick={()=>setDsLog(`Queue front is ${queue[0]}.`)}>Front</button></div>
        </div>
      </div>
      <label style={{display:'block',fontWeight:700,color:'#18334f',margin:'14px 0 6px'}}>Value for Stack / Queue / Linked List</label><input aria-label="Value to add" value={item} onChange={e=>setItem(e.target.value)} placeholder="Enter a value, e.g. 40" style={{...fieldStyle,maxWidth:320}} />
      <div style={{marginTop:14,padding:14,border:'1px solid #dce5ee',borderRadius:10,background:'#fff'}}>
        <strong>3. Linked List — Insert, Delete and Search</strong>
        <p style={{fontSize:12,color:'#64748b'}}>Each value is a node connected in sequence.</p>
        <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',margin:'10px 0'}}>{linkedList.length?linkedList.map((v,i)=><span key={`${v}-${i}`} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'8px 12px',background:'#fff2d9',border:'1px solid #f0d49b',borderRadius:7,fontWeight:700,margin:3}}>{v}<span aria-hidden="true">{i<linkedList.length-1?'→':'→ null'}</span></span>):'List is empty'}</div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><button type="button" style={buttonStyle} onClick={()=>{if(item.trim()){setLinkedList(v=>[...v,item.trim()]);setDsLog(`Inserted ${item.trim()} at the end of the linked list.`);setItem('');}}}>Insert at end</button><button type="button" style={secondaryStyle} disabled={!linkedList.length} onClick={()=>{const v=linkedList[linkedList.length-1];setLinkedList(a=>a.slice(0,-1));setDsLog(`Deleted last node (${v}).`);}}>Delete last</button><button type="button" style={secondaryStyle} disabled={!linkedList.length} onClick={()=>setDsLog(`Search result: ${linkedList.includes(searchTarget)?`${searchTarget} is in the linked list.`:`${searchTarget} was not found.`}`)}>Search value</button></div>
      </div>
      <div style={{marginTop:14,padding:14,border:'1px solid #dce5ee',borderRadius:10,background:'#fff'}}>
        <strong>4. Sorting and Searching</strong>
        <p style={{fontSize:13,color:'#64748b'}}>Array: [{dsArray.join(', ')}]</p>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><label htmlFor="ds-search-target" style={{fontWeight:600}}>Target value</label><input id="ds-search-target" value={searchTarget} onChange={e=>setSearchTarget(e.target.value)} style={{...fieldStyle,maxWidth:100}}/><button type="button" style={buttonStyle} onClick={()=>{const sorted=[...dsArray].sort((a,b)=>a-b);setDsArray(sorted);setDsLog(`Sorted array in ascending order: [${sorted.join(', ')}].`);}}>Sort ascending</button><button type="button" style={secondaryStyle} onClick={()=>{const index=dsArray.indexOf(Number(searchTarget));setDsLog(index>=0?`Linear search: ${searchTarget} found at index ${index}.`:`Linear search: ${searchTarget} not found.`);}}>Linear Search</button><button type="button" style={secondaryStyle} onClick={()=>{const sorted=[...dsArray].sort((a,b)=>a-b);setDsArray(sorted);let low=0,high=sorted.length-1,found=-1;while(low<=high){const mid=Math.floor((low+high)/2);if(sorted[mid]===Number(searchTarget)){found=mid;break;}if(sorted[mid]<Number(searchTarget))low=mid+1;else high=mid-1;}setDsLog(found>=0?`Binary search on sorted array: ${searchTarget} found at index ${found}.`:`Binary search: ${searchTarget} not found.`);}}>Binary Search</button><button type="button" style={secondaryStyle} onClick={()=>{setDsArray([8,3,6,1,9]);setDsLog('Array reset to [8, 3, 6, 1, 9].');}}>Reset array</button></div>
      </div>
      <div role="status" aria-live="polite" style={{marginTop:14,padding:12,borderRadius:8,background:'#0b1728',color:'#b9f3dc',fontFamily:'Consolas,monospace',fontSize:13}}>{dsLog}</div>
    </div>}
    {isWeb && <><h4 style={{color:'#18334f',margin:'18px 0 8px'}}>Live Preview</h4><iframe title="Web development live preview" sandbox="allow-scripts" srcDoc={previewCode || '<p style="font-family:Arial;padding:16px;color:#64748b">Click Run Preview to display your web page.</p>'} style={{width:'100%',minHeight:280,border:'1px solid #cbd5e1',borderRadius:10,background:'#fff'}} /></>}
    {isDatabase && <div style={{margin:'18px 0',padding:14,border:'1px solid #dce5ee',borderRadius:10,background:'#fbfdff'}}><h4 style={{margin:'0 0 8px',color:'#18334f'}}>Sample students table</h4><p style={{fontSize:12,color:'#64748b'}}>INSERT, UPDATE and DELETE change this practice table while the workspace is open. Reset Example restores the original rows.</p><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['id','name','marks','course'].map(col=><th key={col} style={{textAlign:'left',padding:9,background:'#e8eef4',borderBottom:'1px solid #cbd5e1'}}>{col}</th>)}</tr></thead><tbody>{sqlRows.map(row=><tr key={row.id}>{['id','name','marks','course'].map(col=><td key={col} style={{padding:9,borderBottom:'1px solid #e2e8f0'}}>{row[col]}</td>)}</tr>)}</tbody></table></div></div>}
    <div role="status" aria-live="polite" style={{color:'#526174',fontSize:13,margin:'12px 0 8px'}}>{status}</div>
    <h4 style={{color:'#18334f',margin:'12px 0 8px'}}>Output</h4>
    <pre style={{boxSizing:'border-box',minHeight:90,whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#0b1728',color:'#b9f3dc',padding:16,borderRadius:10,fontFamily:'Consolas,monospace',lineHeight:1.6}}>{output}</pre>
    {isJava && <p style={{color:'#64748b',fontSize:12}}>Note: This local learning runner executes code on the computer running your backend. Run only code you trust. Do not expose this development endpoint to the public internet; production use needs an isolated sandbox.</p>}
    {isDatabase && <p style={{color:'#64748b',fontSize:12}}>Note: This SQL learning simulator supports SELECT, WHERE, ORDER BY, LIMIT, COUNT(*), INSERT, UPDATE and DELETE on its local sample table. It does not read or change your real Firebase database.</p>}
    <p style={{color:'#64748b',fontSize:12}}>Your work is saved in your signed-in Firebase account under coursePrograms. Download a copy for a separate backup.</p>
  </section>;
}

// FEATURE 15 — WIZIAI SMART TUTOR
// AI responses are generated by the secured FastAPI backend, never by a browser-side API key.
function WiZiAISmartTutor() {
  const [tutorUser, setTutorUser] = useState(auth.currentUser);
  const [course, setCourse] = useState("Python Programming");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const [tutorNotice, setTutorNotice] = useState("Ask a question to start learning with WiZiAI.");
  const [language, setLanguage] = useState("English");
  const [listening, setListening] = useState(false);
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [codeMode, setCodeMode] = useState(false);

  const tutorCourses = ["Python Programming", "Java Programming", "Web Development", "Database Management", "Data Structures", "Artificial Intelligence", "Mathematics", "Other"];

  useEffect(() => onAuthStateChanged(auth, (user) => setTutorUser(user)), []);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!tutorUser) {
        setConversations([]);
        setMessages([]);
        setActiveConversationId(null);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      try {
        const historyQuery = query(
          collection(db, "aiTutorConversations"),
          where("ownerId", "==", tutorUser.uid)
        );
        const snapshot = await getDocs(historyQuery);
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        rows.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        if (!cancelled) setConversations(rows);
      } catch (error) {
        console.error("WiZiAI history load failed:", error);
        if (!cancelled) setTutorError(`Could not load chat history (${error.code || error.message}). Check aiTutorConversations Firestore rules.`);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [tutorUser]);

  function startNewChat() {
    setActiveConversationId(null);
    setMessages([]);
    setDraft("");
    setTutorError("");
    setTutorNotice("New conversation. What would you like to understand?");
  }

  function openConversation(item) {
    setActiveConversationId(item.id);
    setMessages(Array.isArray(item.messages) ? item.messages : []);
    setCourse(item.course || "Python Programming");
    setTutorError("");
    setTutorNotice("Previous conversation loaded.");
  }

  async function sendQuestion(event, overrideQuestion = null) {
    event?.preventDefault?.();
    const question = String(overrideQuestion ?? draft).trim();
    if (!question || sending) return;
    if (!tutorUser) {
      setTutorError("Please sign in to use WiZiAI and save your conversation.");
      return;
    }

    const userMessage = { role: "user", content: question, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setTutorError("");
    setTutorNotice("WiZiAI is preparing an explanation...");

    try {
      // The backend owns the model/API key. Never put a provider secret in React.
      const response = await fetch(`${API_URL}/tutor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tutorUser ? { Authorization: `Bearer ${await tutorUser.getIdToken()}` } : {}) },
        body: JSON.stringify({
          message: question,
          course,
          history: messages.slice(-12).map(({ role, content }) => ({ role, content })),
          language,
          document_context: pdfText
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.detail || data.error || `Tutor API returned HTTP ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const answer = data.reply || data.answer || data.response || data.message;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("The tutor API returned no answer. Expected a 'reply', 'answer', or 'response' string.");
      }

      const assistantMessage = { role: "assistant", content: answer.trim(), createdAt: new Date().toISOString() };
      const finalMessages = [...nextMessages, assistantMessage];
      setMessages(finalMessages);
      const conversationRef = activeConversationId
        ? doc(db, "aiTutorConversations", activeConversationId)
        : doc(collection(db, "aiTutorConversations"));
      const title = question.length > 58 ? `${question.slice(0, 55)}...` : question;
      const payload = {
        ownerId: tutorUser.uid,
        ownerEmail: tutorUser.email || "",
        course,
        title: activeConversationId ? (conversations.find((item) => item.id === activeConversationId)?.title || title) : title,
        messages: finalMessages,
        updatedAt: serverTimestamp()
      };
      if (activeConversationId) {
        await updateDoc(conversationRef, payload);
      } else {
        payload.createdAt = serverTimestamp();
        await setDoc(conversationRef, payload);
        setActiveConversationId(conversationRef.id);
      }
      setConversations((current) => {
        const existing = current.filter((item) => item.id !== conversationRef.id);
        return [{ id: conversationRef.id, ...payload, updatedAt: new Date() }, ...existing];
      });
      setTutorNotice("Answer received and conversation saved to your account.");
    } catch (error) {
      console.error("WiZiAI request failed:", error);
      // Keep the user's question visible, but do not fabricate an AI answer.
      setTutorError(`WiZiAI could not respond: ${error.message}. Confirm that your backend implements POST /api/tutor-chat and that the server is running.`);
      setTutorNotice("Your question is still shown above. You can retry after the tutor service is configured.");
    } finally {
      setSending(false);
    }
  }


  function startVoiceQuestion() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTutorError("Voice input is not supported by this browser. Please use the latest Google Chrome or type your question.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = language === "Telugu" ? "te-IN" : language === "Hindi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); setTutorError(""); setTutorNotice("Listening… speak your question now."); };
    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      setDraft((current) => current ? `${current} ${spoken}` : spoken);
      setTutorNotice("Voice question added. Review it and press Send question.");
    };
    recognition.onerror = (event) => setTutorError(`Voice input failed (${event.error || "unknown error"}). Check microphone permission and try again.`);
    recognition.onend = () => setListening(false);
    try { recognition.start(); } catch { setListening(false); setTutorError("Could not start microphone input. Try again."); }
  }

  async function uploadTutorPdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!tutorUser) { setTutorError("Please sign in before uploading study notes."); event.target.value = ""; return; }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setTutorError("Please choose a PDF file."); event.target.value = ""; return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setTutorError("PDF must be 8 MB or smaller."); event.target.value = ""; return;
    }
    try {
      setPdfBusy(true); setTutorError(""); setTutorNotice("Reading your PDF notes…");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_URL}/tutor-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await tutorUser.getIdToken()}` },
        body: form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "PDF processing failed.");
      setPdfText(data.text || "");
      setPdfName(data.filename || file.name);
      setTutorNotice(`Loaded ${data.filename || file.name} (${data.page_count || "?"} pages). Ask a question about these notes.`);
    } catch (error) {
      setTutorError(`Could not read PDF: ${error.message}`);
      setTutorNotice("Try another text-based PDF.");
    } finally {
      setPdfBusy(false);
      event.target.value = "";
    }
  }

  function askForCodeExplanation() {
    setCodeMode(true);
    setDraft((current) => current
      ? `Explain this code step by step, line by line, and show its output:\n\n${current}`
      : "Please paste your code here. Explain it step by step, line by line, describe the output, and explain any errors.");
  }

  function generateQuizFromConversation() {
    if (!messages.some((item) => item.role === "assistant" || item.role === "user")) {
      setTutorError("Ask WiZiAI a question first. Then you can generate a quiz from the conversation.");
      return;
    }
    const prompt = "Based on the learning conversation above, create a 5-question multiple-choice quiz. Give four options (A-D) for each question, identify the correct answer, and explain why it is correct. Use the selected explanation language.";
    sendQuestion(null, prompt);
  }

  async function deleteConversation(item) {
    if (!tutorUser || !window.confirm("Delete this conversation and its saved messages?")) return;
    try {
      await deleteDoc(doc(db, "aiTutorConversations", item.id));
      setConversations((current) => current.filter((row) => row.id !== item.id));
      if (activeConversationId === item.id) startNewChat();
      setTutorNotice("Conversation deleted.");
    } catch (error) {
      setTutorError(`Could not delete conversation (${error.code || error.message}).`);
    }
  }

  const card = { background: "#fff", border: "1px solid #dce6ee", borderRadius: 14, padding: 16 };
  const action = { border: 0, borderRadius: 9, padding: "10px 14px", background: "#139b91", color: "#fff", fontWeight: 700, cursor: "pointer" };
  const secondary = { border: "1px solid #d7e1eb", borderRadius: 9, padding: "9px 12px", background: "#f7fafc", color: "#18334f", fontWeight: 650, cursor: "pointer" };

  return (
    <section className="dashboard-section" id="smart-tutor">
      <div className="dashboard-section-heading">
        <div><span>WIZIAI LEARNING ASSISTANT</span><h2>WiZiAI Smart Tutor</h2><p className="section-description">Ask by voice or text, upload PDF notes, choose Telugu, Hindi or English, and practise with AI-generated quizzes.</p></div>
        <span className="settings-status">AI learning assistant</span>
      </div>
      <div className="wizia-layout" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 0.8fr) minmax(0, 2fr)", gap: 20, alignItems: "start", width: "100%" }}>
        <aside style={{ ...card, minWidth: 0 }}>
          <button type="button" style={{ ...action, width: "100%" }} onClick={startNewChat}>＋ New conversation</button>
          <h3 style={{ color: "#18334f", fontSize: 16, margin: "18px 0 10px" }}>Recent conversations</h3>
          {!tutorUser ? <p className="demo-note">Sign in to save and revisit your chats.</p> : historyLoading ? <p className="demo-note">Loading chat history...</p> : conversations.length === 0 ? <p className="demo-note">Your saved conversations will appear here.</p> : <div style={{ display: "grid", gap: 8, maxHeight: 430, overflowY: "auto" }}>
            {conversations.map((item) => <div key={item.id} style={{ border: activeConversationId === item.id ? "1px solid #139b91" : "1px solid #e2e8f0", borderRadius: 9, padding: 9, background: activeConversationId === item.id ? "#effaf8" : "#fff" }}>
              <button type="button" onClick={() => openConversation(item)} style={{ border: 0, background: "transparent", textAlign: "left", padding: 0, width: "100%", cursor: "pointer", color: "#18334f", fontWeight: 700 }}>{item.title || "Untitled conversation"}</button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 7 }}><small style={{ color: "#64748b" }}>{item.course || "General"}</small><button type="button" aria-label="Delete conversation" onClick={() => deleteConversation(item)} style={{ ...secondary, padding: "4px 7px", color: "#b42318", fontSize: 11 }}>Delete</button></div>
            </div>)}
          </div>}
        </aside>

        <div style={{ ...card, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "end", marginBottom: 16 }}>
            <label style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 8, minWidth: 0, width: "100%", color: "#18334f", fontWeight: 650 }}>
              Choose a course or subject
              <select value={course} onChange={(event) => setCourse(event.target.value)} style={{ display: "block", width: "100%", minWidth: 0, boxSizing: "border-box", minHeight: 46, padding: "11px 13px", border: "1px solid #d7e1eb", borderRadius: 10, background: "#fff", color: "#18334f", font: "inherit" }}>{tutorCourses.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <button type="button" style={{ ...secondary, minHeight: 44, whiteSpace: "nowrap" }} onClick={startNewChat}>Clear chat</button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end", margin: "0 0 14px" }}>
            <label style={{ display: "grid", gap: 5, color: "#18334f", fontWeight: 650, flex: "1 1 180px" }}>
              Explanation language
              <select value={language} onChange={(event) => setLanguage(event.target.value)} style={{ minHeight: 42, padding: 9, border: "1px solid #d7e1eb", borderRadius: 9, background: "#fff", color: "#18334f", font: "inherit" }}>
                <option>English</option><option>Telugu</option><option>Hindi</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 5, color: "#18334f", fontWeight: 650, flex: "1 1 220px" }}>
              Upload PDF notes (max 8 MB)
              <input type="file" accept="application/pdf,.pdf" onChange={uploadTutorPdf} disabled={pdfBusy} />
            </label>
            {pdfName && <span style={{ color: "#087e70", fontSize: 12 }}>Attached: {pdfName} <button type="button" style={{ ...secondary, padding: "4px 8px" }} onClick={() => { setPdfText(""); setPdfName(""); }}>Remove</button></span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <button type="button" style={secondary} onClick={startVoiceQuestion} disabled={listening}>{listening ? "Listening…" : "🎙️ Speak question"}</button>
            <button type="button" style={secondary} onClick={askForCodeExplanation}>{"</>"} Explain code step by step</button>
            <button type="button" style={secondary} onClick={generateQuizFromConversation} disabled={sending || messages.length === 0}>Generate quiz from chat</button>
          </div>
          <div aria-live="polite" style={{ boxSizing: "border-box", width: "100%", minWidth: 0, minHeight: 320, maxHeight: 520, overflowY: "auto", padding: 18, borderRadius: 13, background: "#f5f8fc", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && <div style={{ margin: "auto", textAlign: "center", maxWidth: 440, padding: 24 }}><div style={{ fontSize: 34 }}>✨</div><h3 style={{ color: "#18334f" }}>What would you like to learn?</h3><p style={{ color: "#64748b", lineHeight: 1.6 }}>Ask for a concept explanation, a worked example, help understanding code, or a short practice quiz.</p><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}><button type="button" style={secondary} onClick={() => setDraft("Explain Python functions with a simple example.")}>Explain a concept</button><button type="button" style={secondary} onClick={() => setDraft("Help me debug this code and explain the error:")}>Debug code</button><button type="button" style={secondary} onClick={() => setDraft("Give me 5 practice questions about this subject.")}>Practice questions</button></div></div>}
            {messages.map((message, index) => <div key={`${message.createdAt || index}-${index}`} style={{ alignSelf: message.role === "user" ? "flex-end" : "stretch", maxWidth: message.role === "user" ? "88%" : "100%", background: message.role === "user" ? "#dff5f0" : "#fff", border: "1px solid #e1e8ef", borderRadius: 11, padding: 12, color: "#18334f", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.65 }}><strong style={{ display: "block", fontSize: 11, color: message.role === "user" ? "#087e70" : "#526174", marginBottom: 5 }}>{message.role === "user" ? "YOU" : "WIZIAI"}</strong>{message.content}</div>)}
            {sending && <div style={{ color: "#64748b", padding: 8 }}>WiZiAI is thinking…</div>}
          </div>
          <form onSubmit={sendQuestion} style={{ marginTop: 16, display: "grid", gap: 9, width: "100%", minWidth: 0 }}>
            <label style={{ display: "grid", gap: 8, width: "100%", minWidth: 0, color: "#18334f", fontWeight: 650 }}>
              Your question
              <textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={pdfName ? `Ask a question about ${pdfName}...` : "Ask a question about your course..."} maxLength={6000} style={{ display: "block", width: "100%", minWidth: 0, minHeight: 116, boxSizing: "border-box", resize: "vertical", padding: "13px 14px", border: "1px solid #d7e1eb", borderRadius: 11, background: "#fff", color: "#18334f", font: "inherit", lineHeight: 1.5 }} />
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 9 }}><small style={{ color: "#64748b" }}>{draft.length}/6000 characters · Check important answers with your course materials.</small><button type="submit" style={action} disabled={sending || !draft.trim()}>{sending ? "Thinking…" : "Send question ➤"}</button></div>
          </form>
          {tutorError && <p className="auth-error" role="alert" style={{ marginTop: 12 }}>{tutorError}</p>}
          <p className="demo-note" role="status" style={{ marginTop: 10 }}>{tutorNotice}</p>
          <p className="demo-note">AI answers can be incorrect. Do not enter passwords, private student records, or other sensitive information.</p>
        </div>
      </div>
      <style>{`#smart-tutor{min-width:0}#smart-tutor .wizia-layout{grid-template-columns:minmax(240px,.8fr) minmax(0,2fr)}#smart-tutor button:focus-visible,#smart-tutor select:focus-visible,#smart-tutor textarea:focus-visible{outline:3px solid rgba(19,155,145,.22);outline-offset:2px}@media(max-width:760px){#smart-tutor .wizia-layout{grid-template-columns:minmax(0,1fr)!important}#smart-tutor .wizia-layout>aside{order:2}#smart-tutor .wizia-layout>div{order:1}#smart-tutor .wizia-layout>div>div:first-child{grid-template-columns:minmax(0,1fr)!important}#smart-tutor .wizia-layout>div>div:first-child>button{width:100%}}`}</style>
    </section>
  );
}


// FEATURE 16 — SECURE FACULTY ASSESSMENTS
function AssessmentCenter({ accountRole }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("Python Programming");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [duration, setDuration] = useState("20");
  const [active, setActive] = useState(null);
  const [attemptId, setAttemptId] = useState("");
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const staff = ["faculty", "admin"].includes(accountRole);

  async function api(path, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again to continue.");
    const token = await user.getIdToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Assessment request failed.");
    return data;
  }

  async function loadAssessments() {
    try {
      setLoading(true); setError("");
      const data = await api("/assessments");
      setItems(Array.isArray(data.assessments) ? data.assessments : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAssessments(); }, [accountRole]);
  useEffect(() => {
    if (!deadline || !active || result) return;
    let expired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !expired) { expired = true; setDeadline(null); submitAttempt(true); }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, active, result]);

  async function createAssessment(event) {
    event.preventDefault();
    if (notes.trim().length < 20) { setError("Add at least 20 characters of source notes."); return; }
    if (!Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 500) { setError("Choose between 1 and 500 questions."); return; }
    if (!Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 600) { setError("Choose a time limit between 1 and 600 minutes."); return; }
    try {
      setBusy(true); setError(""); setMessage("");
      const generated = await api("/assessments/generate", { method: "POST", body: JSON.stringify({ topic: title.trim() || course, notes: notes.trim(), question_count: Number(count), difficulty }) });
      const created = await api("/assessments", { method: "POST", body: JSON.stringify({ title: title.trim() || `${course} Assessment`, course, difficulty, duration_minutes: Number(duration), questions: generated.questions }) });
      setMessage(`Draft created: ${created.title}. Publish it when ready for students.`);
      setTitle(""); setNotes(""); await loadAssessments();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function publishAssessment(item) {
    try { setBusy(true); setError(""); await api(`/assessments/${item.id}/publish`, { method: "POST" }); setMessage("Assessment published."); await loadAssessments(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function deleteAssessment(item) {
    if (!window.confirm(`Delete assessment “${item.title}”?`)) return;
    try { setBusy(true); await api(`/assessments/${item.id}`, { method: "DELETE" }); setMessage("Assessment deleted."); await loadAssessments(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function startAssessment(item) {
    try {
      setBusy(true); setError(""); setResult(null); setAnswers({});
      const data = await api(`/assessments/${item.id}/start`, { method: "POST" });
      setActive({ ...data.assessment, id: item.id, questions: data.questions });
      setAttemptId(data.attempt_id);
      const end = new Date(data.deadline).getTime(); setDeadline(end); setRemaining(Math.max(0, Math.ceil((end-Date.now())/1000)));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submitAttempt(auto = false) {
    if (!active || !attemptId || busy || result) return;
    try {
      setBusy(true); setError("");
      const data = await api(`/assessments/${active.id}/submit`, { method: "POST", body: JSON.stringify({ attempt_id: attemptId, answers, auto_submitted: auto }) });
      setResult(data.result); setDeadline(null); setMessage(auto ? "Time expired. Your assessment was submitted automatically." : "Assessment submitted and graded securely.");
      await loadAssessments();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function loadAnalytics(item) {
    try { setBusy(true); setError(""); const data = await api(`/assessments/${item.id}/analytics`); setAnalytics({ ...data, title: item.title }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2,"0")}:${(seconds % 60).toString().padStart(2,"0")}`;

  return <section className="dashboard-section" id="assessment-center">
    <div className="dashboard-section-heading"><div><span>FEATURE 16 · SECURE ASSESSMENTS</span><h2>Assessment Center</h2><p className="section-description">Faculty-published timed assessments with backend grading and protected answer keys.</p></div></div>
    {error && <div className="demo-result" role="alert"><p>{error}</p></div>}
    {message && <p className="demo-note" role="status">{message}</p>}
    {staff && <form className="workspace-card" onSubmit={createAssessment} style={{padding:24, marginBottom:20, borderRadius:18, border:"1px solid #e6edf5", boxShadow:"0 8px 28px rgba(15,35,65,.05)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginBottom:20}}>
        <div><span style={{color:"#16b8a9",fontSize:12,fontWeight:800,letterSpacing:1.3}}>FACULTY WORKSPACE</span><h3 style={{margin:"5px 0 6px",fontSize:23}}>Create a new assessment</h3><p className="demo-note" style={{margin:0}}>Build a timed assessment from your course study notes.</p></div>
        <span style={{background:"#e9fbf8",color:"#087e70",padding:"8px 12px",borderRadius:10,fontSize:12,fontWeight:750}}>SECURE ASSESSMENT</span>
      </div>
      <div className="form-grid">
        <label>Assessment title<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Java Programming – Unit 1 Test" /></label>
        <label>Course<select value={course} onChange={e=>setCourse(e.target.value)}>{["Python Programming","Java Programming","Web Development","Data Structures","Artificial Intelligence","Database Management"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{gridColumn:"1 / -1"}}>Difficulty level
          <div role="group" aria-label="Difficulty level" style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:8}}>
            {["Beginner","Intermediate","Advanced"].map(level=><button key={level} type="button" aria-pressed={difficulty===level} onClick={()=>setDifficulty(level)} style={{border:`1px solid ${difficulty===level?"#0aa99b":"#dbe5ef"}`,background:difficulty===level?"#e8faf7":"#fff",color:difficulty===level?"#087e70":"#334155",borderRadius:10,padding:"10px 18px",fontWeight:750,cursor:"pointer"}}>{level}</button>)}
          </div>
        </label>
        <label>Number of questions<input type="number" min="1" max="500" step="1" required value={count} onChange={e=>setCount(e.target.value)} /><small style={{display:"block",color:"#64748b",fontWeight:400,marginTop:5}}>Choose the number you need (up to 500 per assessment).</small></label>
        <label>Time limit (minutes)<input type="number" min="1" max="600" required value={duration} onChange={e=>setDuration(e.target.value)} /></label>
      </div>
      <label className="full-label" style={{display:"block",marginTop:18}}>Study notes<textarea rows="7" required value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Paste the lesson notes, definitions, examples and key concepts used to create the questions (at least 20 characters)." /></label>
      <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginTop:16}}>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? "Generating questions…" : "✦ Generate assessment draft"}</button>
        <span className="demo-note">Your draft is saved privately until you publish it.</span>
      </div>
      <p className="demo-note" style={{marginTop:12}}>Review generated questions before publishing. The maximum question count is subject to your backend generator and hosting resources.</p>
    </form>}

    {active && <div className="workspace-card" style={{padding:22,marginBottom:20}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><div><h3 style={{margin:"0 0 6px"}}>{active.title}</h3><p className="demo-note">{active.course} · {active.difficulty}</p></div><strong style={{fontSize:22,color:remaining<=60?"#b42318":"#18334f"}}>⏱ {formatTime(remaining)}</strong></div>
      {active.questions.map((q,i)=><div className="quiz-question" key={`${i}-${q.question}`}><h3>{i+1}. {q.question}</h3>{q.options.map((option,j)=><label className="quiz-option" key={j}><input type="radio" name={`assessment-${i}`} checked={answers[i]===j} onChange={()=>setAnswers(a=>({...a,[i]:j}))} disabled={!!result}/>{option}</label>)}</div>)}
      {!result ? <button type="button" className="primary-action" disabled={busy} onClick={()=>submitAttempt(false)}>{busy?"Submitting…":"Submit assessment"}</button> : <div className="quiz-score"><b>Score: {result.score}/{result.total_questions} ({result.percentage}%)</b><p>{result.feedback || "Your answers have been graded by the server."}</p>{result.review?.map((r,i)=><p key={i} className="demo-note">{i+1}. {r.correct ? "Correct" : `Incorrect · Correct answer: ${r.correct_answer}`} — {r.explanation || "Review this concept."}</p>)}<button type="button" className="secondary-action" onClick={()=>{setActive(null);setResult(null);setAttemptId("");loadAssessments();}}>Back to assessments</button></div>}
    </div>}

    {analytics && <div className="workspace-card" style={{padding:20,marginBottom:18}}><h3>{analytics.title} · Course analytics</h3><div className="form-grid"><p><b>{analytics.total_attempts}</b><br/>Attempts</p><p><b>{analytics.average_percentage}%</b><br/>Average score</p><p><b>{analytics.pass_rate}%</b><br/>Pass rate</p></div><button className="secondary-action" onClick={()=>setAnalytics(null)}>Close analytics</button></div>}
    <div className="workspace-card" style={{padding:22}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><h3 style={{marginTop:0}}>{staff?"Your assessments":"Published assessments"}</h3><button type="button" className="secondary-action" onClick={loadAssessments}>Refresh</button></div>
      {loading?<p className="demo-note">Loading assessments…</p>:items.length===0?<p className="demo-note">No assessments are available yet.</p>:<div style={{display:"grid",gap:12}}>{items.map(item=><div key={item.id} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:15}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><strong>{item.title}</strong><p className="demo-note">{item.course} · {item.difficulty} · {item.question_count} questions · {item.duration_minutes} min</p></div><span className="demo-note">{item.status}</span></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{!staff && <button type="button" className="primary-action" disabled={busy||!!active} onClick={()=>startAssessment(item)}>Start assessment</button>}{staff && item.status!=="published" && <button type="button" className="primary-action" disabled={busy} onClick={()=>publishAssessment(item)}>Publish</button>}{staff && <button type="button" className="secondary-action" disabled={busy} onClick={()=>loadAnalytics(item)}>Analytics</button>}{staff && <button type="button" className="secondary-action" disabled={busy} onClick={()=>deleteAssessment(item)}>Delete</button>}</div></div>)}</div>}
    </div>
  </section>;
}

// FEATURE 17 — Career & Placement Readiness Center
function CareerPlacementCenter({ accountRole }) {
  const [uid, setUid] = useState(auth.currentUser?.uid || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [skills, setSkills] = useState("Python, HTML, CSS, JavaScript");
  const [interests, setInterests] = useState("Software Development, AI");
  const [targetRole, setTargetRole] = useState("Full Stack Developer");
  const [roadmap, setRoadmap] = useState([]);
  const [applications, setApplications] = useState([]);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobStatus, setJobStatus] = useState("Interested");
  const [resume, setResume] = useState({name:"", email:"", phone:"", summary:"", education:"", projects:"", links:""});
  const [interviewIndex, setInterviewIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const interviewQuestions = [
    {q:"Tell me about yourself and the projects you have built.", hint:"Use a concise present–past–future structure. Mention your strongest project and your contribution."},
    {q:"How would you explain the difference between a process and a thread?", hint:"Compare memory, execution context, communication, and overhead."},
    {q:"Describe a difficult bug you solved. How did you investigate it?", hint:"Explain the symptoms, reproduction, debugging steps, root cause, fix, and result."},
    {q:"What happens when you enter a URL in a browser?", hint:"Cover DNS, connection/TLS, HTTP request, server response, and browser rendering."}
  ];
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUid(user?.uid || ""));
    return () => unsub();
  }, []);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!uid) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, "users", uid, "careerCenter", "workspace"));
        if (alive && snap.exists()) {
          const d = snap.data();
          setSkills(d.skills || "Python, HTML, CSS, JavaScript"); setInterests(d.interests || "Software Development, AI");
          setTargetRole(d.targetRole || "Full Stack Developer"); setRoadmap(Array.isArray(d.roadmap) ? d.roadmap : []);
          setApplications(Array.isArray(d.applications) ? d.applications : []);
          setResume({...{name:"",email:"",phone:"",summary:"",education:"",projects:"",links:""}, ...(d.resume || {})});
        }
      } catch (e) { if (alive) setError("Could not load your career workspace. Check your Firebase sign-in and Firestore rules."); }
      finally { if (alive) setLoading(false); }
    }
    load(); return () => { alive = false; };
  }, [uid]);
  async function saveWorkspace(patch = {}) {
    if (!uid) { setError("Please sign in again to save your career workspace."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = {skills, interests, targetRole, roadmap, applications, resume, ...patch, updatedAt: serverTimestamp()};
      await setDoc(doc(db, "users", uid, "careerCenter", "workspace"), payload, {merge:true});
      setMessage("Your career workspace has been saved securely.");
    } catch (e) { setError(e.message || "Unable to save your career workspace."); }
    finally { setSaving(false); }
  }
  async function buildRoadmap() {
    setRecommendationLoading(true); setError(""); setMessage("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/career/recommendations`, {method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body:JSON.stringify({skills:skills.split(",").map(x=>x.trim()).filter(Boolean), interests:interests.split(",").map(x=>x.trim()).filter(Boolean), target_role:targetRole})});
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || "Could not generate recommendations.");
      setRoadmap(data.roadmap || []); await saveWorkspace({roadmap:data.roadmap || []});
      setMessage("Career roadmap generated. Review the suggested learning steps and track your progress.");
    } catch (e) { setError(e.message || "Career roadmap request failed."); }
    finally { setRecommendationLoading(false); }
  }
  async function addApplication(e) {
    e.preventDefault(); if (!company.trim() || !jobTitle.trim()) return;
    const next = [{id:crypto.randomUUID(), company:company.trim(), title:jobTitle.trim(), status:jobStatus, createdAt:new Date().toISOString()}, ...applications];
    setApplications(next); setCompany(""); setJobTitle(""); await saveWorkspace({applications:next});
  }
  async function updateApplication(id, status) { const next=applications.map(a=>a.id===id?{...a,status}:a); setApplications(next); await saveWorkspace({applications:next}); }
  async function removeApplication(id) { const next=applications.filter(a=>a.id!==id); setApplications(next); await saveWorkspace({applications:next}); }
  async function updateResume(key, value) { const next={...resume,[key]:value}; setResume(next); }
  const completedSteps = roadmap.filter(x=>x.completed).length;
  const progress = roadmap.length ? Math.round(completedSteps / roadmap.length * 100) : 0;
  const fieldStyle={width:"100%",padding:"11px 12px",border:"1px solid #dbe4ee",borderRadius:9,background:"#fff",color:"#18334f",font:"inherit",boxSizing:"border-box"};
  if (loading) return <section className="dashboard-section" id="career-center"><p className="demo-note">Loading your career workspace…</p></section>;
  return <section className="dashboard-section" id="career-center">
    <div className="dashboard-section-heading"><div><span>FEATURE 17 · CAREER DEVELOPMENT</span><h2>Career & Placement Readiness Center</h2><p className="section-description">Build your career roadmap, prepare for interviews, create a resume, and track applications.</p></div></div>
    {error && <div className="demo-result" role="alert"><p>{error}</p></div>}{message && <p className="demo-note" role="status">{message}</p>}
    <div className="dashboard-stats" style={{marginBottom:20}}>
      {[ ["🎯","Target role",targetRole], ["🧭","Roadmap progress",`${progress}%`], ["💼","Applications",String(applications.length)], ["🧩","Roadmap steps",`${completedSteps}/${roadmap.length}`] ].map(([icon,label,value])=><div className="dashboard-stat-card" key={label}><span>{icon}</span><small>{label}</small><strong style={{fontSize:17}}>{value}</strong></div>)}
    </div>
    <div className="workspace-card" style={{padding:22,marginBottom:18}}>
      <h3 style={{marginTop:0}}>1. Personalized career roadmap</h3>
      <div className="form-grid">
        <label>Target career role<input style={fieldStyle} value={targetRole} onChange={e=>setTargetRole(e.target.value)} placeholder="e.g. Full Stack Developer" /></label>
        <label>Career interests<input style={fieldStyle} value={interests} onChange={e=>setInterests(e.target.value)} placeholder="AI, Web Development, Data" /></label>
      </div>
      <label className="full-label">Your current skills (comma-separated)<textarea style={fieldStyle} rows="2" value={skills} onChange={e=>setSkills(e.target.value)} /></label>
      <button className="primary-action" type="button" onClick={buildRoadmap} disabled={recommendationLoading}>{recommendationLoading?"Building roadmap…":"Generate career roadmap"}</button>
      <p className="demo-note">Recommendations are generated by the authenticated SmartLearn backend using transparent role/skill matching. They are guidance, not a hiring guarantee.</p>
      {roadmap.length>0 && <div style={{display:"grid",gap:10,marginTop:16}}>{roadmap.map((step,i)=><label key={step.id || i} style={{display:"flex",gap:12,alignItems:"start",padding:13,border:"1px solid #e2e8f0",borderRadius:11}}><input type="checkbox" checked={!!step.completed} onChange={async e=>{const next=roadmap.map((x,j)=>j===i?{...x,completed:e.target.checked}:x);setRoadmap(next);await saveWorkspace({roadmap:next});}}/><span><strong>{step.title}</strong><span style={{display:"block",fontSize:13,color:"#64748b",marginTop:4}}>{step.description}</span></span></label>)}</div>}
    </div>
    <div className="workspace-card" style={{padding:22,marginBottom:18}}>
      <h3 style={{marginTop:0}}>2. Resume builder</h3><p className="demo-note">Fill in your details to create a clean, copy-ready resume draft. Your information is saved in your private user workspace.</p>
      <div className="form-grid">{[["name","Full name"],["email","Email"],["phone","Phone"],["links","LinkedIn / Portfolio URL"]].map(([key,label])=><label key={key}>{label}<input style={fieldStyle} value={resume[key]} onChange={e=>updateResume(key,e.target.value)} /></label>)}</div>
      {[["summary","Professional summary"],["education","Education"],["projects","Projects and achievements"]].map(([key,label])=><label className="full-label" key={key}>{label}<textarea style={fieldStyle} rows="3" value={resume[key]} onChange={e=>updateResume(key,e.target.value)} placeholder={`Add your ${label.toLowerCase()}…`} /></label>)}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="primary-action" type="button" disabled={saving} onClick={()=>saveWorkspace()}>Save resume</button><button className="secondary-action" type="button" onClick={()=>{const text=[resume.name,resume.email,resume.phone,resume.links,"", "PROFESSIONAL SUMMARY",resume.summary,"", "EDUCATION",resume.education,"", "PROJECTS",resume.projects].join("\n"); const blob=new Blob([text],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="SmartLearn_Resume.txt";a.click();URL.revokeObjectURL(url);}}>Export resume (.txt)</button></div>
    </div>
    <div className="workspace-card" style={{padding:22,marginBottom:18}}>
      <h3 style={{marginTop:0}}>3. Interview practice</h3><p className="demo-note">Practice answering common technical and behavioral interview questions.</p>
      <div style={{padding:16,borderRadius:12,background:"#f5f8fc",border:"1px solid #e2e8f0"}}><small>QUESTION {interviewIndex+1} OF {interviewQuestions.length}</small><h3>{interviewQuestions[interviewIndex].q}</h3><textarea style={fieldStyle} rows="4" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Write your practice answer here…"/><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:10}}><button type="button" className="secondary-action" onClick={()=>setShowHint(v=>!v)}>{showHint?"Hide hint":"Show answer guidance"}</button><button type="button" className="secondary-action" onClick={()=>{setInterviewIndex((interviewIndex+1)%interviewQuestions.length);setAnswer("");setShowHint(false);}}>Next question →</button></div>{showHint&&<p className="demo-note" style={{marginTop:12}}>{interviewQuestions[interviewIndex].hint}</p>}</div>
    </div>
    <div className="workspace-card" style={{padding:22}}>
      <h3 style={{marginTop:0}}>4. Job & internship application tracker</h3>
      <form onSubmit={addApplication}><div className="form-grid"><label>Company<input style={fieldStyle} value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company name" required /></label><label>Role / internship title<input style={fieldStyle} value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="e.g. Software Intern" required /></label><label>Status<select style={fieldStyle} value={jobStatus} onChange={e=>setJobStatus(e.target.value)}>{["Interested","Applied","Assessment","Interview","Offer","Rejected"].map(x=><option key={x}>{x}</option>)}</select></label></div><button className="primary-action" type="submit" disabled={saving}>Add application</button></form>
      {applications.length===0?<p className="demo-note">No applications tracked yet. Add a job or internship to get started.</p>:<div style={{display:"grid",gap:10,marginTop:16}}>{applications.map(a=><div key={a.id} style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",padding:13,border:"1px solid #e2e8f0",borderRadius:10}}><div><strong>{a.title}</strong><p className="demo-note" style={{margin:"4px 0 0"}}>{a.company}</p></div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><select aria-label={`Status for ${a.title}`} style={{...fieldStyle,width:"auto"}} value={a.status} onChange={e=>updateApplication(a.id,e.target.value)}>{["Interested","Applied","Assessment","Interview","Offer","Rejected"].map(x=><option key={x}>{x}</option>)}</select><button type="button" className="secondary-action" onClick={()=>removeApplication(a.id)}>Remove</button></div></div>)}</div>}
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button type="button" className="secondary-action" disabled={saving} onClick={()=>saveWorkspace()}>{saving?"Saving…":"Save career workspace"}</button></div>
    {!["student",""].includes(String(accountRole||"student").toLowerCase()) && <p className="demo-note">Staff view: this career workspace is scoped to the currently signed-in account. Student career records are not exposed to other users by this feature.</p>}
  </section>;
}


// FEATURE 21 — ACCESSIBILITY & MULTILINGUAL LEARNING ASSISTANT
function AccessibilityLearningAssistant({ onNavigate, navigationItems = [] }) {
  const languageOptions = [
    { label: "English", code: "en-US" },
    { label: "తెలుగు (Telugu)", code: "te-IN" },
    { label: "हिन्दी (Hindi)", code: "hi-IN" },
    { label: "தமிழ் (Tamil)", code: "ta-IN" },
    { label: "ಕನ್ನಡ (Kannada)", code: "kn-IN" },
    { label: "മലയാളം (Malayalam)", code: "ml-IN" },
    { label: "বাংলা (Bengali)", code: "bn-IN" },
    { label: "मराठी (Marathi)", code: "mr-IN" },
    { label: "اردو (Urdu)", code: "ur-PK" }
  ];
  const [language, setLanguage] = useState("en-US");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState("");
  const [voiceNavigationLanguage, setVoiceNavigationLanguage] = useState("en-US");
  const [speechRate, setSpeechRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedLanguage = languageOptions.find((item) => item.code === language) || languageOptions[0];
  const displayText = translatedText.trim() || sourceText;
  const availableVoices = voices.filter((voice) => voice.lang?.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  const activeVoice = voices.find((voice) => voice.name === voiceName) || availableVoices[0] || null;

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid, "accessibilityPreferences", "settings"));
        if (!active || !snapshot.exists()) return;
        const saved = snapshot.data();
        if (saved.language) setLanguage(saved.language);
        if (saved.fontSize) setFontSize(Math.min(30, Math.max(14, Number(saved.fontSize))));
        if (saved.lineSpacing) setLineSpacing(Math.min(2.4, Math.max(1.3, Number(saved.lineSpacing))));
        setHighContrast(Boolean(saved.highContrast));
        setDyslexiaFont(Boolean(saved.dyslexiaFont));
        setFocusMode(Boolean(saved.focusMode));
        if (saved.speechRate) setSpeechRate(Math.min(1.5, Math.max(0.7, Number(saved.speechRate))));
        if (saved.voiceName) setVoiceName(saved.voiceName);
        if (saved.voiceNavigationLanguage) setVoiceNavigationLanguage(saved.voiceNavigationLanguage);
        setMessage("Your saved accessibility preferences have been restored.");
      } catch (loadError) {
        console.warn("Accessibility preferences could not be loaded:", loadError);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function speakText() {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }
    if (!displayText.trim()) {
      setError("Paste lesson text or add a translated version before listening.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayText);
    utterance.lang = language;
    utterance.rate = speechRate;
    if (activeVoice) utterance.voice = activeVoice;
    utterance.onstart = () => { setSpeaking(true); setError(""); setMessage("Reading your learning content aloud."); };
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setError("Speech playback could not be completed."); };
    window.speechSynthesis.speak(utterance);
  }

  function pauseSpeech() {
    if (!("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    else window.speechSynthesis.pause();
    setMessage(window.speechSynthesis.paused ? "Speech paused." : "Speech resumed.");
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setMessage("Speech stopped.");
  }

  function normalizeVoiceCommand(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^(?:(?:please|kindly)\s+)?(?:can you\s+)?(?:please\s+)?(?:open|go to|navigate to|show|take me to|switch to|launch)\s+/, "")
      .replace(/^(?:the|my)\s+/, (match) => match.toLowerCase() === "the " ? "" : "my ");
  }

  function startVoiceNavigation() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Voice navigation is not available in this browser. Try Google Chrome or use the navigation menu.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = voiceNavigationLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      setListening(true);
      setError("");
      setMessage("Listening for a navigation command…");
    };

    recognition.onend = () => setListening(false);

    recognition.onerror = (event) => {
      setListening(false);
      setError(`Voice navigation error: ${event.error || "microphone unavailable"}. Check microphone permission and try again.`);
    };

    recognition.onresult = (event) => {
      const alternatives = Array.from(event.results?.[0] || [])
        .map((item) => item.transcript || "")
        .filter(Boolean);

      const candidates = alternatives
        .map((transcript) => ({
          original: transcript,
          normalized: normalizeVoiceCommand(transcript)
        }))
        .filter((item) => item.normalized);

      // External destinations are kept separate from dashboard sections.
      // These commands open a new tab; they do not change the current dashboard.
      const externalSites = [
        { names: ["youtube", "you tube"], url: "https://www.youtube.com", label: "YouTube" }
      ];

      for (const candidate of candidates) {
        const externalMatch = externalSites.find((site) =>
          site.names.some((name) =>
            candidate.normalized === name ||
            candidate.normalized === `website ${name}` ||
            candidate.normalized === `${name} website`
          )
        );

        if (externalMatch) {
          const opened = window.open(externalMatch.url, "_blank", "noopener,noreferrer");
          if (opened) {
            setMessage(`Opening ${externalMatch.label} in a new tab.`);
            setError("");
          } else {
            setError(`Your browser blocked the ${externalMatch.label} tab. Allow pop-ups for this website and try again.`);
          }
          return;
        }
      }

      const aliases = {
        "home": "dashboard",
        "main page": "dashboard",
        "back": "dashboard",
        "go back": "dashboard",
        "back to home": "dashboard",
        "my course": "my courses",
        "course": "my courses",
        "courses": "my courses",
        "ai tools": "ai study tools",
        "study tool": "ai study tools",
        "study tools": "ai study tools",
        "tutor": "wiziai smart tutor",
        "smart tutor": "wiziai smart tutor",
        "quiz": "quiz generator",
        "assessment": "assessment center",
        "career": "career placement",
        "placement": "career placement",
        "summary": "smart summaries",
        "summaries": "smart summaries",
        "study material": "study materials",
        "material": "study materials",
        "resource": "learning resources",
        "resources": "learning resources",
        "flashcard": "ai flashcards",
        "flash cards": "ai flashcards",
        "timetable": "weekly timetable",
        "reminders": "reminders notifications",
        "notifications": "reminders notifications",
        "goals": "learning goals streaks",
        "groups": "study groups",
        "challenge": "peer challenges",
        "challenges": "peer challenges",
        "forum": "discussion forum",
        "discussion": "discussion forum",
        "feedback": "course feedback",
        "certificate": "my certificates",
        "certificates": "my certificates",
        "progress": "progress overview",
        "placement center": "career placement",
        "practice": "interactive practice lab",
        "practice lab": "interactive practice lab",
        "library": "digital library notes",
        "notes": "digital library notes",
        "exam": "smart exam simulator",
        "exam simulator": "smart exam simulator",
        "interview": "ai interview preparation studio",
        "escape room": "ai educational escape room",
        "debate": "ai debate arena",
        "concept map": "concept map studio",
        "accessibility": "accessibility assistant",
        "profile": "my profile",
        "preferences": "settings",
        "faculty": "faculty admin panel",
        "faculty panel": "faculty admin panel",
        "admin": "admin dashboard",
        "admin panel": "admin dashboard"
      };

      const available = navigationItems.map(([id, , label]) => ({
        id: String(id || ""),
        label: String(label || "").replace(/\s*\(\d+\)\s*$/, "")
      }));

      let match = null;
      let matchedTranscript = "";

      for (const candidate of candidates) {
        const phrase = aliases[candidate.normalized] || candidate.normalized;

        // Prefer exact ID/label matches so similar section names never collide.
        match = available.find((item) =>
          phrase === normalizeVoiceCommand(item.id) ||
          phrase === normalizeVoiceCommand(item.label)
        );

        // Accept a complete section name inside a longer natural sentence.
        if (!match) {
          match = available.find((item) => {
            const idPhrase = normalizeVoiceCommand(item.id);
            const labelPhrase = normalizeVoiceCommand(item.label);
            return (
              (idPhrase.length >= 4 && phrase.includes(idPhrase)) ||
              (labelPhrase.length >= 4 && phrase.includes(labelPhrase)) ||
              (idPhrase.length >= 4 && idPhrase.includes(phrase)) ||
              (labelPhrase.length >= 4 && labelPhrase.includes(phrase))
            );
          });
        }

        if (match) {
          matchedTranscript = candidate.original;
          break;
        }
      }

      if (match) {
        setMessage(`Opening ${match.label}. I heard: "${matchedTranscript}".`);
        setError("");
        onNavigate(match.id);
        return;
      }

      const heard = alternatives[0] || "an unclear command";
      const examples = available.slice(0, 6).map((item) => item.label).join(", ");
      setError(
        `I heard "${heard}", but couldn't match it to an available section. Try saying the exact sidebar name, such as "open My Courses", "open Quiz Generator", or "open Faculty / Admin Panel".`
      );
      setMessage(examples ? `Available sections include: ${examples}.` : "No dashboard navigation sections were provided.");
    };

    try {
      recognition.start();
    } catch (recognitionError) {
      setListening(false);
      setError("Voice recognition could not start. Check microphone permission and try again.");
    }
  }

  async function savePreferences() {
    const user = auth.currentUser;
    if (!user) {
      setError("Please sign in to save accessibility preferences to Firebase.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await setDoc(doc(db, "users", user.uid, "accessibilityPreferences", "settings"), {
        language, fontSize, lineSpacing, highContrast, dyslexiaFont, focusMode, speechRate, voiceName, voiceNavigationLanguage,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setMessage("Accessibility preferences saved to your Firebase account.");
    } catch (saveError) {
      console.error("Saving accessibility preferences failed:", saveError);
      setError(`Could not save preferences: ${saveError.message || "Check Firestore rules."}`);
    } finally {
      setSaving(false);
    }
  }

  const panel = { background: "#fff", border: "1px solid #dce5ee", borderRadius: 16, padding: 20, boxShadow: "0 8px 24px rgba(16,35,63,.05)" };
  const field = { boxSizing: "border-box", width: "100%", padding: 11, borderRadius: 9, border: "1px solid #cbd5e1", font: "inherit" };
  const action = { border: 0, borderRadius: 9, padding: "10px 15px", fontWeight: 700, cursor: "pointer", background: "#139b91", color: "#fff" };
  const secondary = { ...action, background: "#e8eef4", color: "#18334f" };
  const previewStyle = {
    background: highContrast ? "#050505" : "#fbfdff",
    color: highContrast ? "#fff" : "#24364b",
    border: `1px solid ${highContrast ? "#fff" : "#dce5ee"}`,
    borderRadius: 12,
    padding: focusMode ? 28 : 20,
    fontSize: `${fontSize}px`,
    lineHeight: lineSpacing,
    fontFamily: dyslexiaFont ? "Arial, Verdana, sans-serif" : "inherit",
    letterSpacing: dyslexiaFont ? "0.035em" : "normal",
    maxWidth: focusMode ? 760 : "none",
    margin: focusMode ? "0 auto" : 0,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere"
  };

  return (
    <section className="dashboard-section" id="accessibility-assistant">
      <div className="dashboard-section-heading">
        <div>
          <span>LEARN IN YOUR WAY</span>
          <h2>AI Accessibility & Multilingual Learning Assistant</h2>
          <p className="section-description">Listen to learning material, adjust how it appears, and navigate SmartLearn with supported voice commands.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginBottom: 18 }}>
        <article style={panel}>
          <div style={{ fontSize: 25 }}>🔊</div>
          <h3 style={{ color: "#18334f", marginBottom: 6 }}>Listen to lessons</h3>
          <p className="demo-note">Use your browser's built-in speech voices. Choose a language and playback speed.</p>
        </article>
        <article style={panel}>
          <div style={{ fontSize: 25 }}>📖</div>
          <h3 style={{ color: "#18334f", marginBottom: 6 }}>Comfortable reading</h3>
          <p className="demo-note">Change font size, spacing, contrast and reading layout.</p>
        </article>
        <article style={panel}>
          <div style={{ fontSize: 25 }}>🎙️</div>
          <h3 style={{ color: "#18334f", marginBottom: 6 }}>Voice navigation</h3>
          <p className="demo-note">Use short spoken commands to open common learning sections where browser speech recognition is supported.</p>
        </article>
      </div>

      <div style={{ ...panel, marginBottom: 18 }}>
        <h3 style={{ color: "#18334f", marginTop: 0 }}>1. Multilingual listening</h3>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 7, color: "#18334f" }}>Reading language / speech voice</label>
        <select value={language} onChange={(event) => { setLanguage(event.target.value); setVoiceName(""); }} style={{ ...field, marginBottom: 12 }}>
          {languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 7, color: "#18334f" }}>Available voice</label>
        <select value={activeVoice?.name || ""} onChange={(event) => setVoiceName(event.target.value)} style={{ ...field, marginBottom: 12 }}>
          {availableVoices.length === 0 ? <option value="">No installed voice for this language — browser default will be used</option> : availableVoices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} ({voice.lang})</option>)}
        </select>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 7, color: "#18334f" }}>Lesson text (original)</label>
        <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={5} placeholder="Paste lesson text, notes or a summary here…" style={{ ...field, resize: "vertical", marginBottom: 12 }} />
        <label style={{ display: "block", fontWeight: 700, marginBottom: 7, color: "#18334f" }}>Translated lesson text (optional)</label>
        <textarea value={translatedText} onChange={(event) => setTranslatedText(event.target.value)} rows={4} placeholder="Paste a translated version here. Select its language above to listen in that language." style={{ ...field, resize: "vertical" }} />
        <p className="demo-note" style={{ marginBottom: 12 }}>Automatic AI translation is not connected in this frontend-only version. You can paste a translation from your preferred translation tool; the selected browser voice will read it aloud.</p>
        <label style={{ display: "block", fontWeight: 700, color: "#18334f" }}>Speech speed: {speechRate.toFixed(1)}×</label>
        <input type="range" min="0.7" max="1.5" step="0.1" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} style={{ width: "100%", margin: "8px 0 14px" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={action} onClick={speakText}>▶ Listen</button>
          <button type="button" style={secondary} onClick={pauseSpeech} disabled={!speaking}>Ⅱ Pause / Resume</button>
          <button type="button" style={secondary} onClick={stopSpeech}>■ Stop</button>
        </div>
      </div>

      <div style={{ ...panel, marginBottom: 18 }}>
        <h3 style={{ color: "#18334f", marginTop: 0 }}>2. Personal reading mode</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          <label style={{ color: "#18334f", fontWeight: 700 }}>Text size: {fontSize}px
            <input type="range" min="14" max="30" step="1" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} style={{ width: "100%" }} />
          </label>
          <label style={{ color: "#18334f", fontWeight: 700 }}>Line spacing: {lineSpacing.toFixed(1)}
            <input type="range" min="1.3" max="2.4" step="0.1" value={lineSpacing} onChange={(event) => setLineSpacing(Number(event.target.value))} style={{ width: "100%" }} />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "14px 0" }}>
          <label><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} /> High contrast</label>
          <label><input type="checkbox" checked={dyslexiaFont} onChange={(event) => setDyslexiaFont(event.target.checked)} /> Easy-reading font style</label>
          <label><input type="checkbox" checked={focusMode} onChange={(event) => setFocusMode(event.target.checked)} /> Focus mode</label>
        </div>
        <div style={previewStyle} aria-live="polite">
          {displayText.trim() ? displayText : "Your lesson preview will appear here. Paste lesson text above to preview your reading settings."}
        </div>
      </div>

      <div style={panel}>
        <h3 style={{ color: "#18334f", marginTop: 0 }}>3. Voice navigation & saved settings</h3>
        <p className="demo-note">Say “open” followed by any dashboard section name. You can also say “go to”, “show”, or “take me to”. Singular/plural variations such as “open my course” and “open my courses” are supported. Microphone permission is required.</p>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 7, color: "#18334f" }}>Voice command recognition language</label>
        <select value={voiceNavigationLanguage} onChange={(event) => setVoiceNavigationLanguage(event.target.value)} style={{ ...field, marginBottom: 12 }}>
          {languageOptions.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
        <div style={{ background: "#f6f9fc", border: "1px solid #e1e8ef", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <strong style={{ color: "#18334f" }}>Sections you can open by voice</strong>
          <p className="demo-note" style={{ margin: "6px 0 8px" }}>Use the section name shown below, for example “open {navigationItems[0]?.[2] || "dashboard"}”.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {navigationItems.map(([id, , label]) => <span key={id} style={{ background: "#e8f2f4", color: "#176b68", borderRadius: 20, padding: "5px 9px", fontSize: 12 }}>{label}</span>)}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 14 }}>
          <button type="button" style={action} onClick={startVoiceNavigation} disabled={listening}>{listening ? "Listening…" : "🎙️ Start voice command"}</button>
          <button type="button" style={secondary} onClick={savePreferences} disabled={saving}>{saving ? "Saving…" : "Save my preferences"}</button>
          <button type="button" style={secondary} onClick={() => { setLanguage("en-US"); setFontSize(18); setLineSpacing(1.8); setHighContrast(false); setDyslexiaFont(false); setFocusMode(false); setSpeechRate(1); setVoiceName(""); setVoiceNavigationLanguage("en-US"); setMessage("Default reading settings restored. Save to keep them."); }}>Reset settings</button>
        </div>
        {message && <p className="success-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <p className="demo-note">Preferences are saved privately under users/{'{uid}'}/accessibilityPreferences/settings. Speech and voice recognition availability depends on the browser and installed language voices.</p>
      </div>
    </section>
  );
}


// FEATURE 22 — CONCEPT MAP & MIND MAP STUDIO
function ConceptMapStudio() {
  const [mapTitle, setMapTitle] = useState("My Concept Map");
  const [course, setCourse] = useState("General Learning");
  const [nodes, setNodes] = useState([
    { id: "root", title: "Main Topic", detail: "Start with the central idea", parentId: "", color: "#dff5f1" },
    { id: "idea-1", title: "Key Idea 1", detail: "Add a short explanation", parentId: "root", color: "#e8efff" },
    { id: "idea-2", title: "Key Idea 2", detail: "Connect a supporting concept", parentId: "root", color: "#fff1dc" }
  ]);
  const [savedMaps, setSavedMaps] = useState([]);
  const [activeMapId, setActiveMapId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Create a map, then save it to your account.");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newNodeTitle, setNewNodeTitle] = useState("");
  const [newNodeDetail, setNewNodeDetail] = useState("");
  const [newNodeParent, setNewNodeParent] = useState("root");
  const [draggedNodeId, setDraggedNodeId] = useState("");

  const templates = [
    { name: "Computer Science", course: "Computer Science", nodes: [
      ["Computer Science", "Explore how computers process information", "", "#dff5f1"],
      ["Programming", "Instructions, logic and algorithms", "n0", "#e8efff"],
      ["Data Structures", "Organise and access data", "n0", "#fff1dc"],
      ["Databases", "Store, query and manage information", "n0", "#f5e8ff"],
      ["Networks", "Connect devices and exchange data", "n0", "#ffe8ed"]
    ]},
    { name: "Biology", course: "Biology", nodes: [
      ["Living Organisms", "Characteristics of life", "", "#dff5f1"],
      ["Cells", "Basic structural and functional units", "n0", "#e8efff"],
      ["Genetics", "Heredity and variation", "n0", "#fff1dc"],
      ["Ecology", "Organisms and their environment", "n0", "#f5e8ff"],
      ["Evolution", "Change in populations over generations", "n0", "#ffe8ed"]
    ]},
    { name: "Project Plan", course: "Project Management", nodes: [
      ["Project Goal", "Define the outcome", "", "#dff5f1"],
      ["Research", "Gather requirements and context", "n0", "#e8efff"],
      ["Planning", "Tasks, owners and timeline", "n0", "#fff1dc"],
      ["Execution", "Build and track progress", "n0", "#f5e8ff"],
      ["Review", "Test, learn and improve", "n0", "#ffe8ed"]
    ]}
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSavedMaps([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "users", user.uid, "conceptMaps"));
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        items.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setSavedMaps(items);
      } catch (err) {
        console.error("Concept map loading error:", err);
        setError("Could not load saved maps. Check your Firestore permissions.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const visibleNodes = useMemo(() => nodes.filter((node) => `${node.title} ${node.detail}`.toLowerCase().includes(search.toLowerCase())), [nodes, search]);
  const nodePositions = useMemo(() => {
    const columns = 3;
    const positions = {};
    nodes.forEach((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      positions[node.id] = { x: 24 + col * 286, y: 24 + row * 150, cx: 24 + col * 286 + 116, cy: 24 + row * 150 + 48 };
    });
    return positions;
  }, [nodes]);
  const svgHeight = Math.max(190, Math.ceil(nodes.length / 3) * 150 + 24);

  function createFromTemplate(template) {
    const templateId = `node-${Date.now()}`;
    const nextNodes = template.nodes.map((item, index) => ({
      id: `${templateId}-${index}`,
      title: item[0], detail: item[1],
      parentId: item[2] === "n0" ? `${templateId}-0` : "",
      color: item[3]
    }));
    setNodes(nextNodes);
    setMapTitle(`${template.name} Mind Map`);
    setCourse(template.course);
    setActiveMapId("");
    setMessage(`${template.name} template loaded. Customise it and save your map.`);
    setError("");
  }

  function addNode(event) {
    event.preventDefault();
    if (!newNodeTitle.trim()) return;
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const palette = ["#e8efff", "#fff1dc", "#f5e8ff", "#ffe8ed", "#e5f5e8"];
    setNodes((current) => [...current, { id, title: newNodeTitle.trim(), detail: newNodeDetail.trim(), parentId: newNodeParent, color: palette[current.length % palette.length] }]);
    setNewNodeTitle("");
    setNewNodeDetail("");
    setMessage("New idea added to your map.");
  }

  function updateNode(id, field, value) {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, [field]: value } : node));
  }

  function removeNode(id) {
    if (nodes.length <= 1) { setError("Keep at least one idea in your concept map."); return; }
    setNodes((current) => current.filter((node) => node.id !== id).map((node) => node.parentId === id ? { ...node, parentId: "" } : node));
    setMessage("Idea removed. Its connected ideas are now independent topics.");
  }

  async function saveMap() {
    const user = auth.currentUser;
    if (!user) { setError("Sign in to save concept maps to your Firebase account."); return; }
    if (!mapTitle.trim()) { setError("Enter a title for your concept map."); return; }
    try {
      setSaving(true); setError("");
      const payload = { title: mapTitle.trim(), course: course.trim() || "General Learning", nodes, updatedAt: serverTimestamp() };
      if (activeMapId) {
        await updateDoc(doc(db, "users", user.uid, "conceptMaps", activeMapId), payload);
        setSavedMaps((current) => current.map((item) => item.id === activeMapId ? { ...item, ...payload } : item));
        setMessage("Concept map updated in your account.");
      } else {
        const created = await addDoc(collection(db, "users", user.uid, "conceptMaps"), { ...payload, createdAt: serverTimestamp() });
        setActiveMapId(created.id);
        setSavedMaps((current) => [{ ...payload, id: created.id }, ...current]);
        setMessage("Concept map saved to your account.");
      }
    } catch (err) {
      console.error("Concept map save error:", err);
      setError("Could not save this map. Check your Firestore security rules.");
    } finally { setSaving(false); }
  }

  function openMap(item) {
    setMapTitle(item.title || "Untitled Concept Map");
    setCourse(item.course || "General Learning");
    setNodes(Array.isArray(item.nodes) && item.nodes.length ? item.nodes : []);
    setActiveMapId(item.id);
    setMessage(`Opened ${item.title || "saved map"}.`);
    setError("");
  }

  async function deleteMap(item) {
    const user = auth.currentUser;
    if (!user) return;
    if (!window.confirm(`Delete “${item.title || "Untitled map"}”? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "conceptMaps", item.id));
      setSavedMaps((current) => current.filter((map) => map.id !== item.id));
      if (activeMapId === item.id) setActiveMapId("");
      setMessage("Saved map deleted.");
    } catch (err) {
      console.error("Concept map delete error:", err);
      setError("Could not delete this map. Check your Firestore permissions.");
    }
  }

  function exportSvg() {
    const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
    const edges = nodes.filter((node) => node.parentId && nodePositions[node.parentId] && nodePositions[node.id]).map((node) => {
      const from = nodePositions[node.parentId], to = nodePositions[node.id];
      return `<path d="M ${from.cx} ${from.cy} C ${from.cx} ${from.cy + 55}, ${to.cx} ${to.cy - 55}, ${to.cx} ${to.cy}" fill="none" stroke="#8aa5b8" stroke-width="3"/>`;
    }).join("");
    const cards = nodes.map((node) => {
      const p = nodePositions[node.id];
      return `<g><rect x="${p.x}" y="${p.y}" width="232" height="96" rx="14" fill="${node.color || "#e8efff"}" stroke="#cbd8e3"/><text x="${p.x + 14}" y="${p.y + 34}" font-family="Arial" font-size="17" font-weight="700" fill="#18334f">${esc(node.title).slice(0, 30)}</text><text x="${p.x + 14}" y="${p.y + 61}" font-family="Arial" font-size="12" fill="#526174">${esc(node.detail).slice(0, 42)}</text></g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${svgHeight}" viewBox="0 0 900 ${svgHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="24" y="18" font-family="Arial" font-size="12" fill="#64748b">${esc(mapTitle)}</text>${edges}${cards}</svg>`;
  }

  function downloadMap(format) {
    const svg = exportSvg();
    if (format === "svg") {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `${(mapTitle || "concept-map").replace(/[^a-z0-9-_]/gi, "_")}.svg`; link.click(); URL.revokeObjectURL(url);
      setMessage("Concept map exported as SVG.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) { setError("Allow pop-ups to print or save this map as PDF."); return; }
    printWindow.document.write(`<!doctype html><html><head><title>${mapTitle.replace(/[<>]/g, "")}</title><style>body{font-family:Arial;padding:24px}svg{width:100%;height:auto} @media print{body{padding:0}}</style></head><body>${svg}<script>window.onload=()=>window.print()<\/script></body></html>`);
    printWindow.document.close();
    setMessage("Print dialog opened. Choose Save as PDF to create a PDF copy.");
  }

  function speakMap() {
    if (!("speechSynthesis" in window)) { setError("Text-to-speech is not supported in this browser."); return; }
    const text = `${mapTitle}. ${nodes.map((node) => `${node.title}. ${node.detail}`).join(". ")}`;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    setMessage("Reading your concept map aloud.");
  }

  function reorderNode(targetId) {
    if (!draggedNodeId || draggedNodeId === targetId) return;
    setNodes((current) => {
      const next = [...current];
      const from = next.findIndex((node) => node.id === draggedNodeId);
      const to = next.findIndex((node) => node.id === targetId);
      if (from < 0 || to < 0) return current;
      const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
      return next;
    });
    setDraggedNodeId("");
  }

  return (
    <section className="dashboard-section" id="concept-map-studio">
      <div className="dashboard-section-heading"><div><span>FEATURE 22 · VISUAL LEARNING</span><h2>Concept Map & Mind Map Studio</h2><p className="section-description">Turn complex topics into connected ideas. Create, organise, save and export your learning maps.</p></div></div>
      <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          <label className="full-label">Map title<input value={mapTitle} onChange={(event) => setMapTitle(event.target.value)} maxLength={100} /></label>
          <label className="full-label">Subject / course<input value={course} onChange={(event) => setCourse(event.target.value)} maxLength={80} /></label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {templates.map((template) => <button type="button" className="secondary-action" key={template.name} onClick={() => createFromTemplate(template)}>Use {template.name} template</button>)}
          <button type="button" className="secondary-action" onClick={() => { setMapTitle("Untitled Concept Map"); setCourse("General Learning"); setNodes([{ id: `root-${Date.now()}`, title: "Main Topic", detail: "Describe the central idea", parentId: "", color: "#dff5f1" }]); setActiveMapId(""); setMessage("Started a blank concept map."); }}>New blank map</button>
        </div>
      </div>

      <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ color: "#18334f", margin: 0 }}>Visual map preview</h3><p className="demo-note">Drag idea cards to reorder them. Use the editor below to change their connections.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="secondary-action" onClick={speakMap}>🔊 Read map aloud</button><button type="button" className="secondary-action" onClick={() => downloadMap("svg")}>Export SVG</button><button type="button" className="secondary-action" onClick={() => downloadMap("pdf")}>Print / Save PDF</button></div></div>
        <div style={{ overflowX: "auto", marginTop: 12, border: "1px solid #e2eaf0", borderRadius: 12, background: "#fbfdff", padding: 8 }}>
          <svg role="img" aria-label={`Concept map preview for ${mapTitle}`} viewBox={`0 0 900 ${svgHeight}`} style={{ display: "block", width: "100%", minWidth: 560, height: "auto" }}>
            {nodes.filter((node) => node.parentId && nodePositions[node.parentId]).map((node) => { const from = nodePositions[node.parentId], to = nodePositions[node.id]; return <path key={`edge-${node.id}`} d={`M ${from.cx} ${from.cy} C ${from.cx} ${from.cy + 55}, ${to.cx} ${to.cy - 55}, ${to.cx} ${to.cy}`} fill="none" stroke="#8aa5b8" strokeWidth="3" />; })}
            {nodes.map((node) => { const p = nodePositions[node.id]; return <g key={node.id}><rect x={p.x} y={p.y} width="232" height="96" rx="14" fill={node.color || "#e8efff"} stroke="#cbd8e3" strokeWidth="1.5"/><text x={p.x + 14} y={p.y + 34} fill="#18334f" fontSize="16" fontWeight="700">{node.title.slice(0, 25)}</text><text x={p.x + 14} y={p.y + 61} fill="#526174" fontSize="11">{node.detail.slice(0, 35)}</text></g>; })}
          </svg>
        </div>
      </div>

      <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ color: "#18334f", marginTop: 0 }}>Add a connected idea</h3>
        <form onSubmit={addNode} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end" }}>
          <label className="full-label">Idea / topic<input value={newNodeTitle} onChange={(event) => setNewNodeTitle(event.target.value)} placeholder="e.g. Variables" maxLength={70} required /></label>
          <label className="full-label">Short explanation<input value={newNodeDetail} onChange={(event) => setNewNodeDetail(event.target.value)} placeholder="What does this idea mean?" maxLength={120} /></label>
          <label className="full-label">Connect to<select value={newNodeParent} onChange={(event) => setNewNodeParent(event.target.value)}><option value="">No parent / standalone</option>{nodes.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
          <button className="primary-action" type="submit">+ Add idea</button>
        </form>
      </div>

      <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><h3 style={{ color: "#18334f", margin: 0 }}>Edit and organise ideas ({nodes.length})</h3><input aria-label="Search ideas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search map ideas..." style={{ maxWidth: 260 }} /></div>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {visibleNodes.map((node) => <article key={node.id} draggable onDragStart={() => setDraggedNodeId(node.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderNode(node.id)} onDragEnd={() => setDraggedNodeId("")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9, alignItems: "center", padding: 12, border: "1px solid #dce6ee", borderRadius: 10, background: draggedNodeId === node.id ? "#f0f7ff" : "#fff", cursor: "grab" }}>
            <input aria-label="Idea title" value={node.title} onChange={(event) => updateNode(node.id, "title", event.target.value)} maxLength={70} />
            <input aria-label="Idea explanation" value={node.detail} onChange={(event) => updateNode(node.id, "detail", event.target.value)} maxLength={120} placeholder="Add explanation" />
            <select aria-label="Connected parent idea" value={node.parentId || ""} onChange={(event) => updateNode(node.id, "parentId", event.target.value)}><option value="">No parent / standalone</option>{nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            <button type="button" className="secondary-action" onClick={() => removeNode(node.id)} aria-label={`Remove ${node.title}`}>Remove</button>
          </article>)}
          {visibleNodes.length === 0 && <p className="demo-note">No ideas match your search.</p>}
        </div>
        <p className="demo-note" style={{ marginBottom: 0, marginTop: 10 }}>Tip: drag cards to change their display order. Choose a parent idea to draw a connection in the map.</p>
      </div>

      <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ color: "#18334f", margin: 0 }}>Your saved concept maps</h3><p className="demo-note">Saved privately under your signed-in Firebase account.</p></div><button type="button" className="primary-action" onClick={saveMap} disabled={saving}>{saving ? "Saving..." : activeMapId ? "Update saved map" : "Save map to my account"}</button></div>
        {loading ? <p className="demo-note">Loading saved maps...</p> : !auth.currentUser ? <p className="demo-note">Sign in to save and reopen maps across sessions. You can still create and export maps without signing in.</p> : savedMaps.length === 0 ? <p className="demo-note">No saved maps yet. Save your first map above.</p> : <div style={{ display: "grid", gap: 8, marginTop: 12 }}>{savedMaps.filter((item) => `${item.title} ${item.course}`.toLowerCase().includes(search.toLowerCase())).map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid #e2eaf0", borderRadius: 10, padding: 12 }}><div><strong style={{ color: "#18334f" }}>{item.title}</strong><p className="demo-note" style={{ margin: "3px 0 0" }}>{item.course} · {item.nodes?.length || 0} ideas</p></div><div style={{ display: "flex", gap: 8 }}><button type="button" className="secondary-action" onClick={() => openMap(item)}>Open</button><button type="button" className="secondary-action" onClick={() => deleteMap(item)}>Delete</button></div></div>)}</div>}
        {message && <p role="status" className="demo-note" style={{ marginBottom: 0, marginTop: 12 }}>{message}</p>}
        {error && <p role="alert" style={{ color: "#b42318", marginBottom: 0, marginTop: 8 }}>{error}</p>}
      </div>
    </section>
  );
}


// FEATURE 23 — INTERACTIVE PRACTICE LAB
function InteractivePracticeLab() {
  const [activeTab, setActiveTab] = useState("playground");
  const [language, setLanguage] = useState("html");
  const [htmlCode, setHtmlCode] = useState('<main class="card">\n  <h1>Hello, SmartLearn AI!</h1>\n  <p>Edit this page, then watch your changes in the preview.</p>\n  <button onclick="document.querySelector(\'p\').textContent = \'Great work! Your button works.\'">Try me</button>\n</main>');
  const [cssCode, setCssCode] = useState('body { font-family: Arial, sans-serif; padding: 24px; background: #f1f5f9; }\n.card { max-width: 560px; margin: 30px auto; padding: 28px; background: white; border-radius: 16px; box-shadow: 0 8px 24px #0f172a18; }\nh1 { color: #153653; }\nbutton { border: 0; border-radius: 8px; padding: 10px 16px; background: #139b91; color: white; cursor: pointer; }');
  const [jsCode, setJsCode] = useState("console.log('Welcome to the SmartLearn AI practice lab!');");
  const [selectedChallenge, setSelectedChallenge] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerMessage, setAnswerMessage] = useState("");
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const challenges = [
    { id: "html-heading", track: "HTML", level: "Beginner", title: "Build a page heading", prompt: "Which HTML element represents the most important page heading?", options: ["<head>", "<h1>", "<p>", "<title>"], answer: 1, explanation: "Use <h1> for the main heading visible in the page content." },
    { id: "css-color", track: "CSS", level: "Beginner", title: "Style text", prompt: "Which CSS property changes the text colour?", options: ["font-style", "background", "color", "text-decoration"], answer: 2, explanation: "The color property sets the foreground colour of text." },
    { id: "js-variable", track: "JavaScript", level: "Beginner", title: "Declare a variable", prompt: "Which keyword declares a block-scoped variable that can be reassigned?", options: ["let", "const", "static", "echo"], answer: 0, explanation: "let declares a block-scoped variable that can be reassigned." },
    { id: "python-list", track: "Python", level: "Beginner", title: "Work with lists", prompt: "Which expression adds an item to the end of a Python list named items?", options: ["items.addEnd(x)", "items.append(x)", "append.items(x)", "items.pushBack(x)"], answer: 1, explanation: "list.append(value) adds one item to the end of a Python list." },
    { id: "math-percent", track: "Mathematics", level: "Beginner", title: "Calculate a percentage", prompt: "What is 20% of 150?", options: ["15", "20", "30", "35"], answer: 2, explanation: "20% = 0.2, and 0.2 × 150 = 30." },
    { id: "sql-filter", track: "SQL", level: "Intermediate", title: "Filter database rows", prompt: "Which SQL clause filters rows using a condition?", options: ["ORDER BY", "WHERE", "GROUP BY", "CREATE"], answer: 1, explanation: "WHERE filters rows before the result is returned." },
    { id: "algorithm-loop", track: "Algorithms", level: "Intermediate", title: "Repeat an operation", prompt: "Which control structure repeats a block while a condition is true?", options: ["Sequence", "Selection", "Iteration", "Declaration"], answer: 2, explanation: "Iteration repeats instructions using loops such as while and for." },
    { id: "ai-training", track: "Artificial Intelligence", level: "Intermediate", title: "Understand machine learning", prompt: "What does a supervised learning model learn from?", options: ["Labelled examples", "Only random numbers", "No data", "Hardware instructions"], answer: 0, explanation: "Supervised learning uses labelled training examples with known target outputs." }
  ];
  const currentChallenge = challenges[selectedChallenge];
  const previewDocument = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${cssCode}</style></head><body>${htmlCode}<script>${jsCode.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid, "practiceLab", "progress"));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setScore(Number(data.score) || 0);
          setAttempts(Number(data.attempts) || 0);
          setCompleted(Array.isArray(data.completed) ? data.completed : []);
        }
      } catch (error) {
        console.warn("Practice lab progress could not be loaded:", error);
      }
    });
    return () => unsubscribe();
  }, []);

  const saveProgress = async (next = {}) => {
    const user = auth.currentUser;
    if (!user) {
      setSaveMessage("Sign in to save your practice progress to your account. Your current session progress is still available here.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "practiceLab", "progress"), {
        score: next.score ?? score,
        attempts: next.attempts ?? attempts,
        completed: next.completed ?? completed,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setSaveMessage("Practice progress saved to your account.");
    } catch (error) {
      console.error("Practice lab save error:", error);
      setSaveMessage("Could not save progress. Check your Firestore rules and try again.");
    } finally {
      setSaving(false);
    }
  };

  const checkAnswer = () => {
    if (selectedAnswer === "") {
      setAnswerMessage("Choose an answer first.");
      return;
    }
    const isCorrect = Number(selectedAnswer) === currentChallenge.answer;
    const nextAttempts = attempts + 1;
    const nextScore = score + (isCorrect && !completed.includes(currentChallenge.id) ? 10 : 0);
    const nextCompleted = isCorrect && !completed.includes(currentChallenge.id) ? [...completed, currentChallenge.id] : completed;
    setAttempts(nextAttempts);
    setScore(nextScore);
    setCompleted(nextCompleted);
    setAnswerMessage(`${isCorrect ? "Correct! +10 points." : "Not quite."} ${currentChallenge.explanation}`);
    if (isCorrect) saveProgress({ score: nextScore, attempts: nextAttempts, completed: nextCompleted });
    else saveProgress({ attempts: nextAttempts });
  };

  const loadTemplate = (value) => {
    setLanguage("html");
    if (value === "profile") {
      setHtmlCode('<section class="profile">\n  <div class="avatar">SL</div>\n  <h1>Your Name</h1>\n  <p>Learning something new every day.</p>\n  <a href="https://example.com">My portfolio</a>\n</section>');
      setCssCode('body { font-family: Arial; background: #eef5f7; padding: 30px; }\n.profile { max-width: 420px; margin: auto; text-align: center; padding: 32px; background: white; border-radius: 18px; }\n.avatar { margin: auto; width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: #d9f3ef; color: #087e75; font-weight: bold; }\na { color: #087e75; }');
      setJsCode("console.log('Profile card loaded');");
    } else if (value === "counter") {
      setHtmlCode('<main class="counter">\n  <h1>Counter</h1>\n  <p id="count">0</p>\n  <button id="increase">Add one</button>\n</main>');
      setCssCode('body { font-family: Arial; text-align: center; padding: 40px; }\n.counter { max-width: 360px; margin: auto; padding: 28px; border-radius: 16px; background: #eff6ff; }\n#count { font-size: 48px; font-weight: bold; color: #155e75; }\nbutton { padding: 10px 18px; border: 0; border-radius: 8px; background: #0f9f91; color: white; }');
      setJsCode("let count = 0;\ndocument.getElementById('increase').addEventListener('click', () => {\n  count += 1;\n  document.getElementById('count').textContent = count;\n});");
    } else {
      setHtmlCode('<main class="card">\n  <h1>Hello, SmartLearn AI!</h1>\n  <p>Edit this page, then watch your changes in the preview.</p>\n  <button onclick="document.querySelector(\'p\').textContent = \'Great work! Your button works.\'">Try me</button>\n</main>');
      setCssCode('body { font-family: Arial, sans-serif; padding: 24px; background: #f1f5f9; }\n.card { max-width: 560px; margin: 30px auto; padding: 28px; background: white; border-radius: 16px; }\nh1 { color: #153653; }\nbutton { border: 0; border-radius: 8px; padding: 10px 16px; background: #139b91; color: white; cursor: pointer; }');
      setJsCode("console.log('Welcome to the SmartLearn AI practice lab!');");
    }
    setPreviewKey((value) => value + 1);
  };

  const downloadProject = () => {
    const blob = new Blob([previewDocument], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "smartlearn-practice-project.html";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const panel = { background: "#fff", border: "1px solid #dce6ef", borderRadius: 14, padding: 20, marginTop: 16 };
  const field = { boxSizing: "border-box", width: "100%", padding: 12, border: "1px solid #cbd5e1", borderRadius: 9, fontFamily: "inherit", fontSize: 14 };
  const editor = { ...field, minHeight: 190, resize: "vertical", background: "#10233f", color: "#e7f5f5", fontFamily: "Consolas, monospace", lineHeight: 1.55 };
  const action = { border: 0, borderRadius: 9, padding: "11px 16px", background: "#139b91", color: "white", fontWeight: 700, cursor: "pointer" };
  const secondary = { border: "1px solid #cbd8e5", borderRadius: 9, padding: "10px 14px", background: "#fff", color: "#24425d", fontWeight: 600, cursor: "pointer" };

  return (
    <section className="dashboard-section" id="practice-lab">
      <div className="dashboard-section-heading">
        <div><span>FEATURE 23 · LEARN BY DOING</span><h2>🧪 Interactive Practice Lab</h2><p className="section-description">Build small projects, experiment with code, solve skill challenges and track your practice progress.</p></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 18 }}>
        {[{ label: "Points earned", value: score, icon: "⭐" }, { label: "Challenges completed", value: completed.length, icon: "🏁" }, { label: "Attempts", value: attempts, icon: "📝" }, { label: "Available challenges", value: challenges.length, icon: "🎯" }].map((item) => <div key={item.label} style={{ ...panel, marginTop: 0 }}><div style={{ fontSize: 22 }}>{item.icon}</div><strong style={{ display: "block", color: "#18334f", fontSize: 25, marginTop: 6 }}>{item.value}</strong><span style={{ color: "#64748b", fontSize: 13 }}>{item.label}</span></div>)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
        {[ ["playground", "💻 Code Playground"], ["challenges", "🎯 Skill Challenges"], ["progress", "📈 My Progress"] ].map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} style={activeTab === id ? action : secondary}>{label}</button>)}
      </div>

      {activeTab === "playground" && <div style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h3 style={{ margin: 0, color: "#18334f" }}>Web Coding Playground</h3><p className="demo-note">Edit HTML, CSS and JavaScript. The isolated preview updates when you run it.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select aria-label="Load starter template" onChange={(event) => loadTemplate(event.target.value)} defaultValue="starter" style={{ ...field, width: "auto" }}><option value="starter">Starter page</option><option value="profile">Profile card template</option><option value="counter">Interactive counter template</option></select><button type="button" onClick={() => setPreviewKey((value) => value + 1)} style={action}>▶ Run preview</button><button type="button" onClick={downloadProject} style={secondary}>Download HTML</button></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 14, marginTop: 14 }}>
          <div style={{ display: "grid", gap: 12 }}><label style={{ color: "#18334f", fontWeight: 700 }}>HTML<textarea aria-label="HTML code" spellCheck="false" value={htmlCode} onChange={(event) => setHtmlCode(event.target.value)} style={editor} /></label><label style={{ color: "#18334f", fontWeight: 700 }}>CSS<textarea aria-label="CSS code" spellCheck="false" value={cssCode} onChange={(event) => setCssCode(event.target.value)} style={{ ...editor, minHeight: 150 }} /></label><label style={{ color: "#18334f", fontWeight: 700 }}>JavaScript<textarea aria-label="JavaScript code" spellCheck="false" value={jsCode} onChange={(event) => setJsCode(event.target.value)} style={{ ...editor, minHeight: 150 }} /></label></div>
          <div><h4 style={{ color: "#18334f", marginTop: 0 }}>Live preview</h4><iframe key={previewKey} title="Interactive code preview" sandbox="allow-scripts" srcDoc={previewDocument} style={{ width: "100%", minHeight: 510, border: "1px solid #cbd8e5", borderRadius: 10, background: "white" }} /><p className="demo-note">Preview runs in a sandboxed frame. It does not have access to your dashboard or Firebase account.</p></div>
        </div>
      </div>}

      {activeTab === "challenges" && <div style={panel}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}><div><h3 style={{ margin: 0, color: "#18334f" }}>Skill Challenge</h3><p className="demo-note">Choose a topic and answer the question. Each new correct challenge earns 10 points.</p></div><select aria-label="Choose a practice challenge" value={selectedChallenge} onChange={(event) => { setSelectedChallenge(Number(event.target.value)); setSelectedAnswer(""); setAnswerMessage(""); }} style={{ ...field, width: "auto", minWidth: 220 }}>{challenges.map((challenge, index) => <option key={challenge.id} value={index}>{challenge.track} · {challenge.level}</option>)}</select></div>
        <div style={{ marginTop: 18, padding: 18, borderRadius: 12, background: "#f3f8fb" }}><span style={{ color: "#0b8d83", fontSize: 12, fontWeight: 800 }}>{currentChallenge.track.toUpperCase()} · {currentChallenge.level.toUpperCase()}</span><h3 style={{ color: "#18334f", margin: "8px 0" }}>{currentChallenge.title}</h3><p style={{ color: "#334155", fontSize: 17 }}>{currentChallenge.prompt}</p><div style={{ display: "grid", gap: 9 }}>{currentChallenge.options.map((option, index) => <label key={option} style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, border: "1px solid #d6e1eb", borderRadius: 9, background: selectedAnswer === String(index) ? "#e4f6f2" : "white", cursor: "pointer" }}><input type="radio" name="practice-lab-answer" value={index} checked={selectedAnswer === String(index)} onChange={(event) => { setSelectedAnswer(event.target.value); setAnswerMessage(""); }} />{option}</label>)}</div><div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 14 }}><button type="button" style={action} onClick={checkAnswer}>Check answer</button><button type="button" style={secondary} onClick={() => { setSelectedChallenge((value) => (value + 1) % challenges.length); setSelectedAnswer(""); setAnswerMessage(""); }}>Next challenge →</button></div>{answerMessage && <p role="status" style={{ marginTop: 14, padding: 12, borderRadius: 9, background: answerMessage.startsWith("Correct") ? "#e8f7ef" : "#fff5e8", color: answerMessage.startsWith("Correct") ? "#176b45" : "#80520a" }}>{answerMessage}</p>}</div>
      </div>}

      {activeTab === "progress" && <div style={panel}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h3 style={{ margin: 0, color: "#18334f" }}>Your practice progress</h3><p className="demo-note">Completed challenges and points earned in this practice lab.</p></div><button type="button" style={action} disabled={saving} onClick={() => saveProgress()}>{saving ? "Saving..." : "Save progress to my account"}</button></div><div style={{ marginTop: 16, display: "grid", gap: 10 }}>{challenges.map((challenge) => { const done = completed.includes(challenge.id); return <div key={challenge.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 12, border: "1px solid #dce6ef", borderRadius: 9 }}><div><strong style={{ color: "#18334f" }}>{challenge.title}</strong><div className="demo-note">{challenge.track} · {challenge.level}</div></div><span style={{ color: done ? "#16804d" : "#64748b", fontWeight: 700 }}>{done ? "✓ Completed" : "Not completed"}</span></div>; })}</div>{saveMessage && <p role="status" className="demo-note" style={{ marginTop: 12 }}>{saveMessage}</p>}</div>}
      {saveMessage && activeTab !== "progress" && <p role="status" className="demo-note">{saveMessage}</p>}
      <p className="demo-note" style={{ marginTop: 12 }}>Progress is stored under your signed-in Firebase account in <code>users/{"{uid}"}/practiceLab/progress</code>. Code projects can be downloaded as standalone HTML files. Python, SQL and algorithm questions are knowledge challenges; the live code preview currently runs HTML, CSS and JavaScript.</p>
    </section>
  );
}


// FEATURE 24 — DIGITAL LIBRARY & NOTES MANAGER
function DigitalLibraryNotesManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [noteBody, setNoteBody] = useState("");
  const [editingId, setEditingId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const panel = { background: "#fff", border: "1px solid #dce6ef", borderRadius: 14, padding: 18 };
  const field = { boxSizing: "border-box", width: "100%", padding: 11, border: "1px solid #cbd8e5", borderRadius: 9, fontFamily: "inherit", fontSize: 14, color: "#18334f", background: "#fff" };
  const primary = { border: 0, borderRadius: 9, padding: "11px 16px", background: "#139b91", color: "white", fontWeight: 700, cursor: "pointer" };
  const secondary = { border: "1px solid #cbd8e5", borderRadius: 9, padding: "10px 14px", background: "#fff", color: "#24425d", fontWeight: 600, cursor: "pointer" };

  const loadItems = async (user) => {
    if (!user) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "digitalLibrary"));
      const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      records.sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
      setItems(records);
    } catch (error) {
      console.error("Digital library load error:", error);
      setMessage("Could not load your library. Check your Firestore permissions.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { loadItems(user); });
    return () => unsubscribe();
  }, []);

  const resetNote = () => { setTitle(""); setSubject("General"); setNoteBody(""); setEditingId(""); };

  const saveNote = async () => {
    const user = auth.currentUser;
    if (!user) { setMessage("Please sign in to save notes to your account."); return; }
    if (!title.trim() || !noteBody.trim()) { setMessage("Enter a note title and some note content first."); return; }
    setBusy(true); setMessage("");
    try {
      const payload = { type: "note", title: title.trim(), subject: subject.trim() || "General", content: noteBody, updatedAt: serverTimestamp() };
      if (editingId) await updateDoc(doc(db, "users", user.uid, "digitalLibrary", editingId), payload);
      else await addDoc(collection(db, "users", user.uid, "digitalLibrary"), { ...payload, pinned: false, favorite: false, createdAt: serverTimestamp() });
      await loadItems(user); resetNote(); setMessage(editingId ? "Note updated successfully." : "Note saved to your library.");
    } catch (error) { console.error("Note save error:", error); setMessage("Could not save the note. Check your Firestore permissions."); }
    finally { setBusy(false); }
  };

  const editNote = (item) => { setEditingId(item.id); setTitle(item.title || ""); setSubject(item.subject || "General"); setNoteBody(item.content || ""); setMessage("Editing note: " + (item.title || "Untitled")); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const uploadFile = async () => {
    const user = auth.currentUser;
    if (!user) { setMessage("Please sign in to upload study materials."); return; }
    if (!selectedFile) { setMessage("Choose a file to upload first."); return; }
    if (selectedFile.size > 20 * 1024 * 1024) { setMessage("Please choose a file smaller than 20 MB."); return; }
    setBusy(true); setMessage("");
    try {
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `users/${user.uid}/digitalLibrary/${Date.now()}-${safeName}`;
      const fileRef = storageRef(getStorage(), path);
      await uploadBytes(fileRef, selectedFile, { contentType: selectedFile.type || "application/octet-stream" });
      const downloadUrl = await getDownloadURL(fileRef);
      await addDoc(collection(db, "users", user.uid, "digitalLibrary"), {
        type: "file", title: selectedFile.name, subject: subject.trim() || "General", fileName: selectedFile.name,
        contentType: selectedFile.type || "application/octet-stream", size: selectedFile.size, storagePath: path,
        downloadUrl, pinned: false, favorite: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      setSelectedFile(null);
      const input = document.getElementById("digital-library-file-input"); if (input) input.value = "";
      await loadItems(user); setMessage("Study material uploaded successfully.");
    } catch (error) { console.error("Library upload error:", error); setMessage("Upload failed. Check Firebase Storage configuration and rules."); }
    finally { setBusy(false); }
  };

  const toggleFlag = async (item, key) => {
    const user = auth.currentUser; if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "digitalLibrary", item.id), { [key]: !item[key], updatedAt: serverTimestamp() });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, [key]: !entry[key] } : entry));
    } catch (error) { console.error("Library update error:", error); setMessage("Could not update this item. Check Firestore permissions."); }
  };

  const deleteItem = async (item) => {
    const user = auth.currentUser; if (!user) return;
    if (!window.confirm(`Delete “${item.title || item.fileName || "this item"}” from your library?`)) return;
    setBusy(true);
    try {
      if (item.storagePath) { try { await deleteObject(storageRef(getStorage(), item.storagePath)); } catch (storageError) { console.warn("Storage object could not be deleted:", storageError); } }
      await deleteDoc(doc(db, "users", user.uid, "digitalLibrary", item.id));
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) resetNote();
      if (previewItem?.id === item.id) setPreviewItem(null);
      setMessage("Item deleted from your library.");
    } catch (error) { console.error("Library delete error:", error); setMessage("Could not delete this item. Check your permissions."); }
    finally { setBusy(false); }
  };

  const subjects = [...new Set(items.map((item) => item.subject || "General"))].sort();
  const visibleItems = items.filter((item) => {
    const matchesType = filter === "all" || (filter === "notes" ? item.type === "note" : item.type === "file");
    const matchesSubject = subjectFilter === "all" || (item.subject || "General") === subjectFilter;
    const matchesSearch = `${item.title || ""} ${item.subject || ""} ${item.content || ""} ${item.fileName || ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSubject && matchesSearch;
  }).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));

  const readableSize = (bytes = 0) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const isPreviewable = (item) => item.contentType?.startsWith("image/") || item.contentType === "application/pdf";

  return (
    <section className="dashboard-section" id="digital-library">
      <div className="dashboard-section-heading"><div><span>FEATURE 24 · YOUR LEARNING SPACE</span><h2>📚 Digital Library & Notes Manager</h2><p className="section-description">Keep study files, personal notes and important learning resources organised in one place.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12, marginTop: 18 }}>
        {[{ label: "Library items", value: items.length, icon: "📚" }, { label: "Personal notes", value: items.filter((item) => item.type === "note").length, icon: "📝" }, { label: "Uploaded files", value: items.filter((item) => item.type === "file").length, icon: "📎" }, { label: "Pinned items", value: items.filter((item) => item.pinned).length, icon: "📌" }].map((stat) => <div key={stat.label} style={{ ...panel, padding: 15 }}><div style={{ fontSize: 22 }}>{stat.icon}</div><strong style={{ display: "block", fontSize: 25, color: "#18334f", marginTop: 5 }}>{stat.value}</strong><span style={{ color: "#64748b", fontSize: 13 }}>{stat.label}</span></div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 16, marginTop: 18 }}>
        <div style={panel}>
          <h3 style={{ marginTop: 0, color: "#18334f" }}>{editingId ? "Edit study note" : "Create a study note"}</h3>
          <label style={{ display: "block", color: "#334155", fontWeight: 700, marginBottom: 6 }}>Note title</label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Introduction to Artificial Intelligence" style={{ ...field, marginBottom: 11 }} />
          <label style={{ display: "block", color: "#334155", fontWeight: 700, marginBottom: 6 }}>Subject / course</label>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Computer Science" style={{ ...field, marginBottom: 11 }} />
          <label style={{ display: "block", color: "#334155", fontWeight: 700, marginBottom: 6 }}>Note content</label>
          <textarea rows={8} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write definitions, explanations, examples and revision points..." style={{ ...field, resize: "vertical", lineHeight: 1.6 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" style={primary} disabled={busy} onClick={saveNote}>{busy ? "Saving..." : editingId ? "Update note" : "Save note"}</button>{editingId && <button type="button" style={secondary} onClick={resetNote}>Cancel edit</button>}</div>
        </div>
        <div style={panel}>
          <h3 style={{ marginTop: 0, color: "#18334f" }}>Upload study material</h3>
          <p className="demo-note">Add PDFs, Word documents, presentations, spreadsheets, images and other study files. Maximum file size: 20 MB.</p>
          <label style={{ display: "block", color: "#334155", fontWeight: 700, marginBottom: 6 }}>Subject / course</label>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Computer Science" style={{ ...field, marginBottom: 12 }} />
          <label htmlFor="digital-library-file-input" style={{ display: "block", border: "2px dashed #b9cbd9", borderRadius: 12, padding: 24, textAlign: "center", color: "#36516b", cursor: "pointer", background: "#f8fbfd" }}><div style={{ fontSize: 32 }}>☁️</div><strong>Choose a file to upload</strong><div className="demo-note">Click here to browse your device</div><input id="digital-library-file-input" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} style={{ display: "none" }} /></label>
          {selectedFile && <p className="demo-note" style={{ marginTop: 10 }}>Selected: <strong>{selectedFile.name}</strong> · {readableSize(selectedFile.size)}</p>}
          <button type="button" style={{ ...primary, marginTop: 12 }} disabled={busy || !selectedFile} onClick={uploadFile}>{busy ? "Working..." : "Upload to my library"}</button>
          <p className="demo-note" style={{ marginTop: 12 }}>Files are stored in your Firebase Storage account area. Uploading requires Firebase Storage rules that allow the signed-in user to access their own folder.</p>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><h3 style={{ color: "#18334f", margin: 0 }}>My study library ({visibleItems.length})</h3><p className="demo-note">Search, filter, pin, favourite, preview and manage your saved resources.</p></div><input aria-label="Search library" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes and files..." style={{ ...field, maxWidth: 300 }} /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 16px" }}><select aria-label="Filter library type" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ ...field, width: "auto", minWidth: 145 }}><option value="all">All items</option><option value="notes">Notes only</option><option value="files">Files only</option></select><select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} style={{ ...field, width: "auto", minWidth: 160 }}><option value="all">All subjects</option>{subjects.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
        {loading ? <p className="demo-note">Loading your library...</p> : visibleItems.length === 0 ? <div style={{ textAlign: "center", padding: 28, background: "#f8fbfd", borderRadius: 11 }}><div style={{ fontSize: 34 }}>📂</div><h3 style={{ color: "#18334f" }}>Your library is ready</h3><p className="demo-note">Create your first note or upload a study file to get started.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 12 }}>{visibleItems.map((item) => <article key={item.id} style={{ border: "1px solid #dce6ef", borderRadius: 12, padding: 14, background: "#fff", minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><span style={{ fontSize: 24 }}>{item.type === "note" ? "📝" : item.contentType === "application/pdf" ? "📕" : item.contentType?.startsWith("image/") ? "🖼️" : "📎"}</span><div style={{ display: "flex", gap: 5 }}><button type="button" aria-label={item.pinned ? "Unpin item" : "Pin item"} title={item.pinned ? "Unpin" : "Pin"} onClick={() => toggleFlag(item, "pinned")} style={{ ...secondary, padding: "5px 8px" }}>{item.pinned ? "📌" : "＋📌"}</button><button type="button" aria-label={item.favorite ? "Remove favourite" : "Add favourite"} title="Favourite" onClick={() => toggleFlag(item, "favorite")} style={{ ...secondary, padding: "5px 8px" }}>{item.favorite ? "★" : "☆"}</button></div></div><h4 style={{ color: "#18334f", margin: "10px 0 5px", overflowWrap: "anywhere" }}>{item.title || item.fileName || "Untitled"}</h4><div style={{ color: "#0b8d83", fontSize: 12, fontWeight: 700 }}>{item.subject || "General"} · {item.type === "note" ? "NOTE" : "FILE"}</div>{item.type === "note" ? <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{item.content}</p> : <p className="demo-note">{item.fileName} · {readableSize(item.size)}</p>}<div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>{item.type === "note" ? <button type="button" style={secondary} onClick={() => editNote(item)}>Edit note</button> : <><button type="button" style={secondary} onClick={() => setPreviewItem(item)} disabled={!isPreviewable(item)}>Preview</button><a href={item.downloadUrl} target="_blank" rel="noreferrer" style={{ ...secondary, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open / Download</a></>}<button type="button" style={{ ...secondary, color: "#a33b3b" }} disabled={busy} onClick={() => deleteItem(item)}>Delete</button></div></article>)}</div>}
      </div>

      {previewItem && <div role="dialog" aria-modal="true" aria-label="Study material preview" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(10,25,45,.72)", display: "grid", placeItems: "center", padding: 18 }} onClick={() => setPreviewItem(null)}><div onClick={(event) => event.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 14, width: "min(100%,1000px)", height: "min(88vh,760px)", display: "flex", flexDirection: "column", gap: 10 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><strong style={{ color: "#18334f", overflowWrap: "anywhere" }}>{previewItem.title}</strong><button type="button" style={secondary} onClick={() => setPreviewItem(null)}>Close preview ✕</button></div>{previewItem.contentType?.startsWith("image/") ? <img src={previewItem.downloadUrl} alt={previewItem.title} style={{ maxWidth: "100%", maxHeight: "calc(88vh - 90px)", objectFit: "contain", margin: "auto" }} /> : <iframe title={`Preview ${previewItem.title}`} src={previewItem.downloadUrl} style={{ width: "100%", flex: 1, border: "1px solid #dce6ef", borderRadius: 8 }} />}</div></div>}
      {message && <p role="status" className="demo-note" style={{ marginTop: 12, padding: 11, borderRadius: 9, background: "#eef7f6" }}>{message}</p>}
      <p className="demo-note" style={{ marginTop: 12 }}>Your notes and file records are stored in Firestore at <code>users/&#123;uid&#125;/digitalLibrary</code>; uploaded files use the Firebase Storage path <code>users/&#123;uid&#125;/digitalLibrary/...</code>. Word and presentation files can be downloaded; in-browser preview is provided for PDFs and images.</p>
    </section>
  );
}


// FEATURE 25 — SMART EXAM SIMULATOR
function SmartExamSimulator() {
  const [subject, setSubject] = useState("Computer Science");
  const [difficulty, setDifficulty] = useState("All");
  const [questionCount, setQuestionCount] = useState(10);
  const [duration, setDuration] = useState(15);
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const bank = [
    {subject:"Computer Science",difficulty:"Easy",type:"mcq",q:"Which data structure follows FIFO order?",options:["Stack","Queue","Tree","Graph"],answer:"Queue",explanation:"A queue removes the earliest inserted item first (First In, First Out)."},
    {subject:"Computer Science",difficulty:"Easy",type:"mcq",q:"What does CPU stand for?",options:["Central Processing Unit","Computer Personal Unit","Core Program Utility","Central Program User"],answer:"Central Processing Unit",explanation:"The CPU executes instructions and coordinates processing tasks."},
    {subject:"Computer Science",difficulty:"Medium",type:"mcq",q:"Which search algorithm requires sorted data?",options:["Linear search","Binary search","Depth-first search","Hash lookup"],answer:"Binary search",explanation:"Binary search repeatedly halves a sorted search range."},
    {subject:"Computer Science",difficulty:"Medium",type:"short",q:"What is the time complexity of binary search?",answer:"O(log n)",keywords:["log"],explanation:"Binary search halves the remaining search space on each step, giving logarithmic time."},
    {subject:"Computer Science",difficulty:"Hard",type:"mcq",q:"Which structure is commonly used to implement a priority queue efficiently?",options:["Heap","Queue only","Linked list only","Stack"],answer:"Heap",explanation:"A binary heap supports efficient insertion and removal of the highest- or lowest-priority item."},
    {subject:"Mathematics",difficulty:"Easy",type:"mcq",q:"What is 12 × 8?",options:["86","96","108","104"],answer:"96",explanation:"12 multiplied by 8 equals 96."},
    {subject:"Mathematics",difficulty:"Easy",type:"short",q:"What is the square root of 144?",answer:"12",keywords:["12"],explanation:"12 × 12 = 144."},
    {subject:"Mathematics",difficulty:"Medium",type:"mcq",q:"What is the derivative of x²?",options:["x","2x","x³","2"],answer:"2x",explanation:"By the power rule, d(xⁿ)/dx = n·xⁿ⁻¹."},
    {subject:"Mathematics",difficulty:"Medium",type:"mcq",q:"A triangle's angles add up to how many degrees in Euclidean geometry?",options:["90°","180°","270°","360°"],answer:"180°",explanation:"The interior angles of a Euclidean triangle total 180 degrees."},
    {subject:"Mathematics",difficulty:"Hard",type:"short",q:"What is the value of 2⁵?",answer:"32",keywords:["32"],explanation:"2 × 2 × 2 × 2 × 2 = 32."},
    {subject:"Science",difficulty:"Easy",type:"mcq",q:"Which planet is known as the Red Planet?",options:["Venus","Mars","Jupiter","Mercury"],answer:"Mars",explanation:"Iron-rich dust gives Mars its reddish appearance."},
    {subject:"Science",difficulty:"Easy",type:"mcq",q:"What gas do plants absorb during photosynthesis?",options:["Oxygen","Nitrogen","Carbon dioxide","Hydrogen"],answer:"Carbon dioxide",explanation:"Plants use carbon dioxide and water to produce sugars using light energy."},
    {subject:"Science",difficulty:"Medium",type:"short",q:"What is the chemical formula for water?",answer:"H2O",keywords:["h2o"],explanation:"A water molecule contains two hydrogen atoms and one oxygen atom."},
    {subject:"Science",difficulty:"Medium",type:"mcq",q:"What is the SI unit of electric current?",options:["Volt","Ampere","Ohm","Watt"],answer:"Ampere",explanation:"Electric current is measured in amperes (A)."},
    {subject:"Science",difficulty:"Hard",type:"mcq",q:"Which particle has a negative electric charge?",options:["Proton","Neutron","Electron","Photon"],answer:"Electron",explanation:"Electrons carry a negative elementary charge."},
    {subject:"Artificial Intelligence",difficulty:"Easy",type:"mcq",q:"What does AI stand for?",options:["Automated Internet","Artificial Intelligence","Applied Interface","Advanced Input"],answer:"Artificial Intelligence",explanation:"AI refers to computer systems performing tasks associated with human intelligence."},
    {subject:"Artificial Intelligence",difficulty:"Easy",type:"mcq",q:"Which is an example of supervised learning?",options:["Clustering unlabeled data","Training with labeled examples","Random guessing","Data compression"],answer:"Training with labeled examples",explanation:"Supervised learning uses input examples paired with known target labels."},
    {subject:"Artificial Intelligence",difficulty:"Medium",type:"short",q:"What does NLP stand for in AI?",answer:"Natural Language Processing",keywords:["natural","language","processing"],explanation:"NLP helps computers process, interpret, and generate human language."},
    {subject:"Artificial Intelligence",difficulty:"Medium",type:"mcq",q:"Which neural network architecture is widely used for image recognition?",options:["CNN","RNN only","Decision table","Hash map"],answer:"CNN",explanation:"Convolutional Neural Networks learn spatial patterns in image data."},
    {subject:"Artificial Intelligence",difficulty:"Hard",type:"mcq",q:"What is a common risk when training models on biased data?",options:["Guaranteed fairness","Biased predictions","No computation","Perfect accuracy"],answer:"Biased predictions",explanation:"A model can reproduce or amplify patterns and unfairness present in its training data."},
    {subject:"Programming",difficulty:"Easy",type:"mcq",q:"Which symbol is commonly used for a single-line comment in JavaScript?",options:["<!--","//","##","**"],answer:"//",explanation:"JavaScript single-line comments begin with two forward slashes."},
    {subject:"Programming",difficulty:"Easy",type:"short",q:"Which JavaScript keyword declares a block-scoped variable that can be reassigned?",answer:"let",keywords:["let"],explanation:"The let keyword declares a block-scoped variable that may be reassigned."},
    {subject:"Programming",difficulty:"Medium",type:"mcq",q:"Which HTML element creates a hyperlink?",options:["<p>","<a>","<img>","<div>"],answer:"<a>",explanation:"The anchor element (<a>) creates hyperlinks, usually with an href attribute."},
    {subject:"Programming",difficulty:"Medium",type:"mcq",q:"What does CSS primarily control?",options:["Database storage","Webpage presentation","Server routing","CPU scheduling"],answer:"Webpage presentation",explanation:"CSS defines layout, colors, typography, and other presentation rules."},
    {subject:"Programming",difficulty:"Hard",type:"short",q:"What is the output of Boolean(0) in JavaScript?",answer:"false",keywords:["false"],explanation:"Zero is a falsy value in JavaScript, so Boolean(0) evaluates to false."}
  ];

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const user = auth.currentUser;
      if (!user) { setHistoryLoading(false); return; }
      try {
        const snap = await getDocs(collection(db, "users", user.uid, "examAttempts"));
        if (alive) setHistory(snap.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,20));
      } catch (e) { console.error("Exam history load failed", e); if (alive) setNotice("Exam history could not load. Check your Firestore rules."); }
      finally { if (alive) setHistoryLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!exam || result) return;
    if (remaining <= 0) { if (remaining === 0) finishExam(true); return; }
    const timer = setTimeout(() => setRemaining(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [exam, result, remaining]);

  const startExam = () => {
    let pool = bank.filter(q => q.subject === subject && (difficulty === "All" || q.difficulty === difficulty));
    if (!pool.length) return setNotice("No questions found for this selection.");
    pool = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(questionCount, pool.length));
    setExam(pool); setAnswers({}); setResult(null); setRemaining(duration * 60); setNotice("");
  };

  async function finishExam(autoSubmitted = false) {
    if (!exam || result) return;
    const checked = exam.map((q,i) => {
      const raw = String(answers[i] ?? "").trim();
      const correct = q.type === "mcq" ? raw === q.answer : (q.keywords || []).every(k => raw.toLowerCase().includes(k.toLowerCase()));
      return {...q,userAnswer:raw,correct};
    });
    const score = checked.filter(q => q.correct).length;
    const summary = {score,total:checked.length,percentage:Math.round(score/checked.length*100),questions:checked,autoSubmitted};
    setResult(summary); setSaving(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const record = {subject,difficulty,score,total:checked.length,percentage:summary.percentage,autoSubmitted,createdAt:serverTimestamp(),answers:checked.map(q=>({question:q.q,userAnswer:q.userAnswer,correct:q.correct,answer:q.answer}))};
        const ref = await addDoc(collection(db,"users",user.uid,"examAttempts"),record);
        setHistory(prev=>[{id:ref.id,...record,createdAt:{seconds:Math.floor(Date.now()/1000)}},...prev].slice(0,20));
      }
    } catch (e) { console.error("Exam result save failed",e); setNotice("Your result is shown, but saving exam history failed. Check Firestore rules."); }
    finally { setSaving(false); }
  }
  const fmt = n => `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
  const panel = {background:"#fff",border:"1px solid #e1e8f0",borderRadius:14,padding:18,boxShadow:"0 5px 18px rgba(20,45,70,.04)"};
  const field = {padding:"10px 12px",border:"1px solid #ccd8e4",borderRadius:9,background:"#fff",color:"#20364d",width:"100%"};
  const button = {border:0,borderRadius:9,padding:"10px 15px",background:"#087f8c",color:"white",fontWeight:700,cursor:"pointer"};

  return <section className="dashboard-section" id="exam-simulator">
    <div className="dashboard-section-heading"><div><span>FEATURE 25 · TEST YOUR KNOWLEDGE</span><h2>📝 Smart Exam Simulator</h2><p className="section-description">Take timed subject-wise exams, review explanations, and track your progress over time.</p></div></div>
    {!exam && <div style={panel}>
      <h3 style={{marginTop:0,color:"#18334f"}}>Set up your exam</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:13}}>
        <label style={{fontWeight:650,color:"#40546a"}}>Subject<select value={subject} onChange={e=>setSubject(e.target.value)} style={{...field,display:"block",marginTop:6}}>{["Computer Science","Mathematics","Science","Artificial Intelligence","Programming"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{fontWeight:650,color:"#40546a"}}>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)} style={{...field,display:"block",marginTop:6}}>{["All","Easy","Medium","Hard"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={{fontWeight:650,color:"#40546a"}}>Questions<select value={questionCount} onChange={e=>setQuestionCount(Number(e.target.value))} style={{...field,display:"block",marginTop:6}}>{[5,10,15,20].map(x=><option key={x} value={x}>{x} questions</option>)}</select></label>
        <label style={{fontWeight:650,color:"#40546a"}}>Time limit<select value={duration} onChange={e=>setDuration(Number(e.target.value))} style={{...field,display:"block",marginTop:6}}>{[5,10,15,20,30,45,60].map(x=><option key={x} value={x}>{x} minutes</option>)}</select></label>
      </div>
      <p className="demo-note" style={{marginTop:12}}>Questions include multiple-choice and short-answer formats. Short answers are checked against key terms, so equivalent wording may need manual review.</p>
      <button type="button" style={button} onClick={startExam}>Start exam →</button>
    </div>}
    {exam && !result && <div style={panel}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #e7edf3",paddingBottom:12,marginBottom:16}}><div><strong style={{color:"#18334f"}}>{subject} · {exam.length} questions</strong><div className="demo-note">Answer every question, then submit.</div></div><div aria-live="polite" style={{fontSize:22,fontWeight:800,color:remaining<60?"#c0392b":"#087f8c"}}>⏱ {fmt(remaining)}</div></div>
      <div style={{display:"grid",gap:14}}>{exam.map((q,i)=><article key={`${q.q}-${i}`} style={{padding:14,border:"1px solid #e2eaf1",borderRadius:11}}><div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:12,color:"#648096",fontWeight:700,marginBottom:8}}><span>QUESTION {i+1} / {exam.length}</span><span>· {q.difficulty}</span><span>· {q.type === "mcq"?"MULTIPLE CHOICE":"SHORT ANSWER"}</span></div><h4 style={{color:"#20364d",margin:"0 0 12px"}}>{q.q}</h4>{q.type === "mcq" ? <div style={{display:"grid",gap:8}}>{q.options.map(opt=><label key={opt} style={{display:"flex",gap:9,alignItems:"center",padding:10,border:"1px solid #e0e8ef",borderRadius:8,cursor:"pointer",background:answers[i]===opt?"#edf8f8":"#fff"}}><input type="radio" name={`exam-${i}`} checked={answers[i]===opt} onChange={()=>setAnswers(a=>({...a,[i]:opt}))}/>{opt}</label>)}</div> : <input style={field} value={answers[i]||""} onChange={e=>setAnswers(a=>({...a,[i]:e.target.value}))} placeholder="Type your answer..."/>}</article>)}</div>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:16}}><span className="demo-note">{Object.keys(answers).filter(k=>String(answers[k]).trim()).length} of {exam.length} answered</span><button type="button" style={button} onClick={()=>finishExam(false)}>Submit exam</button></div>
    </div>}
    {result && <div style={panel}>
      <div style={{textAlign:"center",padding:"12px 0 20px"}}><div style={{fontSize:42}}>{result.percentage>=80?"🏆":result.percentage>=50?"👏":"📘"}</div><h3 style={{color:"#18334f",margin:"5px 0"}}>Exam completed</h3><div style={{fontSize:38,fontWeight:850,color:"#087f8c"}}>{result.percentage}%</div><p style={{color:"#5e7184"}}>You scored {result.score} out of {result.total}{result.autoSubmitted?" · Automatically submitted when time ran out":""}</p>{saving&&<p className="demo-note">Saving your result...</p>}</div>
      <h3 style={{color:"#18334f"}}>Answer review</h3><div style={{display:"grid",gap:10}}>{result.questions.map((q,i)=><article key={i} style={{padding:12,border:"1px solid #e2eaf1",borderRadius:9}}><strong style={{color:q.correct?"#16835c":"#b44b43"}}>{q.correct?"✓ Correct":"✕ Incorrect"} · {q.q}</strong><p className="demo-note" style={{margin:"7px 0"}}>Your answer: {q.userAnswer||"Not answered"} · Correct answer: {q.answer}</p><p style={{color:"#52677b",margin:0,fontSize:13}}>{q.explanation}</p></article>)}</div>
      <button type="button" style={{...button,marginTop:16}} onClick={()=>{setExam(null);setResult(null);setAnswers({});setRemaining(0);}}>Create another exam</button>
    </div>}
    {notice&&<p role="status" className="demo-note" style={{marginTop:12}}>{notice}</p>}
    <div style={{...panel,marginTop:18}}><h3 style={{color:"#18334f",marginTop:0}}>📊 Recent exam history</h3>{historyLoading?<p className="demo-note">Loading history...</p>:history.length===0?<p className="demo-note">Your completed exams will appear here. Sign in to save your attempts.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr style={{textAlign:"left",color:"#60758a"}}>{["Subject","Score","Result","Date"].map(x=><th key={x} style={{padding:"9px 8px",borderBottom:"1px solid #e4ebf1"}}>{x}</th>)}</tr></thead><tbody>{history.map(h=><tr key={h.id}><td style={{padding:"10px 8px",borderBottom:"1px solid #edf1f5"}}>{h.subject||"Exam"}</td><td style={{padding:"10px 8px",borderBottom:"1px solid #edf1f5"}}>{h.score}/{h.total}</td><td style={{padding:"10px 8px",borderBottom:"1px solid #edf1f5",fontWeight:700,color:Number(h.percentage)>=50?"#16835c":"#b44b43"}}>{h.percentage}%</td><td style={{padding:"10px 8px",borderBottom:"1px solid #edf1f5"}}>{h.createdAt?.seconds?new Date(h.createdAt.seconds*1000).toLocaleDateString():"Just now"}</td></tr>)}</tbody></table></div>}</div>
    <p className="demo-note" style={{marginTop:10}}>Exam attempts are saved in Firestore at <code>users/&#123;uid&#125;/examAttempts</code>. This starter question bank is built in; no AI API or backend server is required.</p>
  </section>;
}


// FEATURE 26 — AI INTERVIEW PREPARATION STUDIO
function AIInterviewPreparationStudio() {
  const [category, setCategory] = useState("Technical");
  const [level, setLevel] = useState("Beginner");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [rating, setRating] = useState({ clarity: 3, relevance: 3, confidence: 3, examples: 3 });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [debateUser, setDebateUser] = useState(auth.currentUser);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(120);
  const [timerRunning, setTimerRunning] = useState(false);
  const [star, setStar] = useState({ situation: "", task: "", action: "", result: "" });

  const questionBank = {
    Technical: {
      Beginner: [
        "Explain the difference between a list and a tuple in Python.",
        "What is object-oriented programming? Explain its main principles.",
        "What is the difference between a primary key and a foreign key?"
      ],
      Intermediate: [
        "How would you find and improve a slow SQL query?",
        "Explain how a REST API works and how you would handle errors.",
        "Describe the time and space complexity of binary search."
      ],
      Advanced: [
        "How would you design a scalable service that handles millions of requests?",
        "Explain concurrency challenges and how you would prevent race conditions.",
        "How would you investigate a production memory leak?"
      ]
    },
    HR: {
      Beginner: [
        "Tell me about yourself and your education.",
        "Why are you interested in this role?",
        "What are your greatest strengths and one area you are improving?"
      ],
      Intermediate: [
        "Describe a time you solved a difficult problem in a team.",
        "Tell me about a mistake you made and what you learned from it.",
        "How do you prioritise tasks when several deadlines overlap?"
      ],
      Advanced: [
        "Describe a time you influenced a decision without formal authority.",
        "How would you handle a disagreement with your manager?",
        "Tell me about a project that failed and how you took responsibility."
      ]
    }
  };
  const questions = questionBank[category][level];
  const currentUser = auth.currentUser;
  const score = Math.round(Object.values(rating).reduce((sum, value) => sum + Number(value), 0) / 4 * 20);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    getDocs(query(collection(db, "users", currentUser.uid, "interviewSessions")))
      .then((snapshot) => {
        if (!cancelled) setHistory(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      })
      .catch((error) => console.error("Interview history loading error:", error));
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); setTimerRunning(false); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const saveAnswer = () => {
    const updated = [...answers];
    updated[activeQuestion] = answer.trim();
    setAnswers(updated);
    setMessage("Answer saved for this practice session.");
  };
  const changeQuestion = (next) => {
    const updated = [...answers];
    updated[activeQuestion] = answer.trim();
    setAnswers(updated);
    setActiveQuestion(next);
    setAnswer(updated[next] || "");
    setMessage("");
    setSeconds(120);
    setTimerRunning(false);
  };
  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMessage("Speech recognition is not supported in this browser. You can type your answer instead."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => setAnswer((previous) => `${previous}${previous ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onerror = () => setMessage("Voice input was unavailable. Please type your answer.");
    recognition.start();
  };
  const saveSession = async () => {
    if (!currentUser) { setMessage("Please sign in again to save your interview practice."); return; }
    const finalAnswers = [...answers];
    finalAnswers[activeQuestion] = answer.trim();
    setSaving(true);
    setMessage("");
    try {
      const payload = { userId: currentUser.uid, category, level, questions, answers: finalAnswers, selfAssessment: rating, score, star, createdAt: serverTimestamp() };
      const saved = await addDoc(collection(db, "users", currentUser.uid, "interviewSessions"), payload);
      setHistory((previous) => [{ id: saved.id, ...payload, createdAt: { toMillis: () => Date.now() } }, ...previous]);
      setAnswers(finalAnswers);
      setMessage("Interview practice saved to your account.");
    } catch (error) {
      console.error("Interview session save error:", error);
      setMessage("Could not save this session. Check your Firestore rules and try again.");
    } finally { setSaving(false); }
  };
  const resetPractice = () => { setActiveQuestion(0); setAnswer(""); setAnswers([]); setRating({ clarity: 3, relevance: 3, confidence: 3, examples: 3 }); setSeconds(120); setTimerRunning(false); setMessage(""); };
  const formatTime = (value) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  const panel = { background: "#fff", border: "1px solid #dbe5ef", borderRadius: 15, padding: 18, boxShadow: "0 5px 18px rgba(20,50,80,.04)" };
  const field = { width: "100%", padding: "11px 12px", border: "1px solid #cbd8e5", borderRadius: 9, font: "inherit", boxSizing: "border-box" };
  const primary = { border: 0, borderRadius: 9, padding: "11px 16px", background: "#139b91", color: "white", fontWeight: 700, cursor: "pointer" };
  const secondary = { border: "1px solid #cbd8e5", borderRadius: 9, padding: "10px 14px", background: "#fff", color: "#29445f", fontWeight: 650, cursor: "pointer" };

  return <section className="dashboard-section" id="interview-prep-studio">
    <div className="dashboard-section-heading"><div><span>FEATURE 26 · CAREER READINESS</span><h2>🎤 AI Interview Preparation Studio</h2><p className="section-description">Practise technical and HR interviews, structure strong answers and track your preparation.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, margin: "18px 0" }}>
      {[{ label: "Practice type", value: category }, { label: "Difficulty", value: level }, { label: "Questions", value: questions.length }, { label: "Self-rating", value: `${score}/100` }].map((item) => <div key={item.label} style={panel}><span style={{ color: "#71839a", fontSize: 13 }}>{item.label}</span><strong style={{ display: "block", color: "#18334f", fontSize: 22, marginTop: 5 }}>{item.value}</strong></div>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16 }}>
      <div style={panel}>
        <h3 style={{ marginTop: 0, color: "#18334f" }}>🎯 Set up your mock interview</h3>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Interview category</label>
        <select value={category} onChange={(event) => { setCategory(event.target.value); resetPractice(); }} style={{ ...field, marginBottom: 12 }}><option>Technical</option><option>HR</option></select>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Difficulty</label>
        <select value={level} onChange={(event) => { setLevel(event.target.value); resetPractice(); }} style={{ ...field, marginBottom: 14 }}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
        <div style={{ background: "#f2f8fb", borderRadius: 12, padding: 14 }}><span style={{ color: "#61758c", fontSize: 13 }}>QUESTION {activeQuestion + 1} OF {questions.length}</span><h3 style={{ color: "#18334f", lineHeight: 1.5 }}>{questions[activeQuestion]}</h3><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontSize: 22, color: seconds === 0 ? "#dc2626" : "#139b91", fontVariantNumeric: "tabular-nums" }}>{formatTime(seconds)}</strong><button type="button" style={secondary} onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? "Pause timer" : "Start 2-minute timer"}</button><button type="button" style={secondary} onClick={() => { setSeconds(120); setTimerRunning(false); }}>Reset</button></div></div>
        <label style={{ display: "block", fontWeight: 700, margin: "14px 0 6px" }}>Your answer</label>
        <textarea rows={7} maxLength={5000} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Structure your response clearly. Include examples where possible..." style={{ ...field, resize: "vertical", lineHeight: 1.6 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><button type="button" style={secondary} onClick={startVoiceInput}>🎙️ Speak answer</button><button type="button" style={secondary} onClick={saveAnswer}>Save answer</button></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14 }}><button type="button" style={secondary} disabled={activeQuestion === 0} onClick={() => changeQuestion(activeQuestion - 1)}>Previous</button><button type="button" style={primary} disabled={activeQuestion === questions.length - 1} onClick={() => changeQuestion(activeQuestion + 1)}>Next question</button></div>
      </div>
      <div style={panel}>
        <h3 style={{ marginTop: 0, color: "#18334f" }}>⭐ Evaluate your answer</h3><p className="demo-note">Rate yourself honestly. This is a reflection score, not an automated AI assessment.</p>
        {[{ key: "clarity", label: "Clarity and structure" }, { key: "relevance", label: "Relevance to the question" }, { key: "confidence", label: "Confidence and delivery" }, { key: "examples", label: "Examples and evidence" }].map((item) => <label key={item.key} style={{ display: "block", margin: "16px 0", color: "#334155", fontWeight: 650 }}>{item.label}<div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 7 }}><input type="range" min="1" max="5" value={rating[item.key]} onChange={(event) => setRating((current) => ({ ...current, [item.key]: Number(event.target.value) }))} style={{ flex: 1 }} /><strong>{rating[item.key]}/5</strong></div></label>)}
        <div style={{ background: "#effaf8", borderRadius: 12, padding: 14, marginTop: 14 }}><span style={{ color: "#53736f", fontSize: 13 }}>YOUR REFLECTION SCORE</span><strong style={{ display: "block", color: "#087f75", fontSize: 32 }}>{score}/100</strong><p style={{ marginBottom: 0, color: "#52706d", fontSize: 13 }}>Improve your lowest-rated area in your next practice attempt.</p></div>
        <h3 style={{ color: "#18334f", marginTop: 22 }}>🧩 STAR answer builder</h3><p className="demo-note">Use this structure for behavioural HR questions.</p>
        {[{ key: "situation", label: "Situation", hint: "What was the context?" }, { key: "task", label: "Task", hint: "What were you responsible for?" }, { key: "action", label: "Action", hint: "What steps did you take?" }, { key: "result", label: "Result", hint: "What was the outcome?" }].map((item) => <label key={item.key} style={{ display: "block", fontWeight: 700, marginTop: 10 }}>{item.label}<textarea rows={2} value={star[item.key]} onChange={(event) => setStar((current) => ({ ...current, [item.key]: event.target.value }))} placeholder={item.hint} style={{ ...field, marginTop: 5, resize: "vertical" }} /></label>)}
      </div>
    </div>
    <div style={{ ...panel, marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><div><h3 style={{ color: "#18334f", margin: 0 }}>Save your interview attempt</h3><p className="demo-note">Your questions, answers and self-evaluation are saved privately under your signed-in account.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" style={secondary} onClick={resetPractice}>Start over</button><button type="button" style={primary} disabled={saving} onClick={saveSession}>{saving ? "Saving..." : "Save interview session"}</button></div></div>{message && <p role="status" style={{ color: message.includes("Could not") || message.includes("Please sign") ? "#b45309" : "#087f75", fontWeight: 650 }}>{message}</p>}</div>
    <div style={{ ...panel, marginTop: 16 }}><h3 style={{ color: "#18334f", marginTop: 0 }}>📈 Your interview history</h3>{history.length === 0 ? <p className="demo-note">No saved practice sessions yet. Complete a mock interview and save it to see your progress here.</p> : <div style={{ display: "grid", gap: 10 }}>{history.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: 12, background: "#f7fafc", borderRadius: 10 }}><div><strong style={{ color: "#18334f" }}>{item.category} · {item.level}</strong><div className="demo-note">{item.questions?.length || 0} questions · {item.createdAt?.toDate?.().toLocaleString?.() || "Saved practice"}</div></div><strong style={{ color: "#139b91" }}>{item.score ?? 0}/100</strong></div>)}</div>}</div>
  </section>;
}



// FEATURE 27 — AI EDUCATIONAL ESCAPE ROOM
function AIEducationalEscapeRoom() {
  const rooms = [
    { id: "computer-science", title: "The Cyber Vault", subject: "Computer Science", icon: "💻", story: "A research lab has locked its data behind three logic gates. Solve each challenge to recover the access key.", puzzles: [
      { question: "Which number comes next in this binary sequence: 1, 10, 11, 100, ?", accepted: ["101"], hint: "These are binary representations of 1, 2, 3, 4. What is 5 in binary?", explain: "The next number is 101, which represents decimal 5." },
      { question: "A password has 3 characters. Each character can be A or B. How many different passwords are possible?", accepted: ["8", "eight"], hint: "There are 2 choices for each of 3 positions: 2 × 2 × 2.", explain: "There are 2³ = 8 possible passwords." },
      { question: "What data structure follows the Last In, First Out (LIFO) principle?", accepted: ["stack", "a stack"], hint: "Think of a pile of plates: the last plate placed is the first one removed.", explain: "A stack follows LIFO: the most recently added item is removed first." }
    ]},
    { id: "science", title: "The Element Lab", subject: "Science", icon: "🧪", story: "A laboratory's safety system has activated. Complete the science challenges to restore the experiment.", puzzles: [
      { question: "What is the chemical symbol for water?", accepted: ["h2o", "h₂o"], hint: "A water molecule contains two hydrogen atoms and one oxygen atom.", explain: "Water is H₂O: two hydrogen atoms bonded to one oxygen atom." },
      { question: "Which planet is known as the Red Planet?", accepted: ["mars"], hint: "It is the fourth planet from the Sun.", explain: "Mars appears reddish because iron minerals in its soil have oxidised." },
      { question: "What force pulls objects toward the Earth?", accepted: ["gravity", "gravitational force"], hint: "It keeps us on the ground and makes objects fall.", explain: "Gravity is the attractive force between objects with mass." }
    ]},
    { id: "mathematics", title: "The Number Temple", subject: "Mathematics", icon: "🔢", story: "An ancient temple door opens only when its number puzzles are solved. Find the answers to unlock the final chamber.", puzzles: [
      { question: "What is 15% of 200?", accepted: ["30", "thirty"], hint: "10% of 200 is 20 and 5% is 10.", explain: "15% of 200 = 0.15 × 200 = 30." },
      { question: "A rectangle is 8 cm long and 5 cm wide. What is its area in square centimetres?", accepted: ["40", "40 cm2", "40cm2", "40 square centimetres"], hint: "Area of a rectangle = length × width.", explain: "8 × 5 = 40 cm²." },
      { question: "Solve for x: 3x + 5 = 20.", accepted: ["5", "x=5", "x = 5"], hint: "Subtract 5 from both sides, then divide by 3.", explain: "3x = 15, so x = 5." }
    ]}
  ];
  const [roomIndex, setRoomIndex] = useState(0);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState({});
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const currentUser = auth.currentUser;
  const room = rooms[roomIndex];
  const puzzle = room.puzzles[puzzleIndex];
  const progressKey = `${room.id}-${puzzleIndex}`;
  const totalPuzzles = rooms.reduce((sum, item) => sum + item.puzzles.length, 0);
  const completedCount = Object.keys(completed).filter((key) => completed[key]).length;
  const normalise = (value) => String(value || "").toLowerCase().replace(/₂/g, "2").replace(/[^a-z0-9]/g, "");

  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      if (!currentUser) { setLoading(false); return; }
      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid, "escapeRoomProgress", "current"));
        if (snapshot.exists() && !cancelled) {
          const data = snapshot.data();
          setCompleted(data.completed || {});
          setPoints(Number(data.points) || 0);
          setRoomIndex(Math.min(Math.max(Number(data.roomIndex) || 0, 0), rooms.length - 1));
        }
      } catch (error) {
        console.error("Escape Room progress load error:", error);
        if (!cancelled) setMessage("Could not load saved progress. You can still play this session.");
      } finally { if (!cancelled) setLoading(false); }
    }
    loadProgress();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  const persistProgress = async (nextCompleted, nextPoints, nextRoomIndex) => {
    if (!currentUser) { setMessage("Sign in to save your Escape Room progress across devices."); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, "users", currentUser.uid, "escapeRoomProgress", "current"), {
        completed: nextCompleted, points: nextPoints, roomIndex: nextRoomIndex,
        completedCount: Object.values(nextCompleted).filter(Boolean).length,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setMessage("Progress saved to your account.");
    } catch (error) {
      console.error("Escape Room progress save error:", error);
      setMessage("Progress could not be saved. Check your connection and Firestore rules.");
    } finally { setSaving(false); }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) { setFeedback("Enter an answer before checking."); return; }
    if (completed[progressKey]) { setFeedback("You have already solved this challenge."); return; }
    const correct = puzzle.accepted.some((item) => normalise(item) === normalise(answer));
    if (!correct) { setFeedback("Not quite. Try again, or reveal a hint."); return; }
    const nextCompleted = { ...completed, [progressKey]: true };
    const earned = hintVisible ? 5 : 10;
    const nextPoints = points + earned;
    setCompleted(nextCompleted);
    setPoints(nextPoints);
    setFeedback(`Correct! ${puzzle.explain} You earned ${earned} points.`);
    await persistProgress(nextCompleted, nextPoints, roomIndex);
  };

  const selectRoom = (index) => {
    const unlocked = index === 0 || rooms.slice(0, index).every((item) => item.puzzles.every((_, i) => completed[`${item.id}-${i}`]));
    if (!unlocked) { setMessage("Complete the previous room to unlock this one."); return; }
    setRoomIndex(index); setPuzzleIndex(0); setAnswer(""); setHintVisible(false); setFeedback(""); setFinished(false); setMessage("");
  };
  const nextPuzzle = () => {
    if (!completed[progressKey]) { setFeedback("Solve this challenge before moving on."); return; }
    if (puzzleIndex < room.puzzles.length - 1) { setPuzzleIndex((value) => value + 1); setAnswer(""); setHintVisible(false); setFeedback(""); }
    else if (roomIndex < rooms.length - 1) { const nextRoom = roomIndex + 1; setRoomIndex(nextRoom); setPuzzleIndex(0); setAnswer(""); setHintVisible(false); setFeedback("Room cleared! The next room is unlocked."); persistProgress(completed, points, nextRoom); }
    else { setFinished(true); setFeedback("Amazing work! You escaped every room."); }
  };
  const resetGame = async () => {
    const empty = {};
    setCompleted(empty); setPoints(0); setRoomIndex(0); setPuzzleIndex(0); setAnswer(""); setHintVisible(false); setFeedback(""); setFinished(false);
    await persistProgress(empty, 0, 0);
  };

  const panel = { background: "#fff", border: "1px solid #e3eaf1", borderRadius: 14, padding: 18, boxShadow: "0 5px 18px rgba(25,50,75,.04)" };
  const primary = { border: 0, borderRadius: 9, padding: "11px 16px", background: "#087f8c", color: "#fff", fontWeight: 750, cursor: "pointer" };
  const secondary = { border: "1px solid #d5e1ea", borderRadius: 9, padding: "10px 14px", background: "#fff", color: "#29445c", fontWeight: 700, cursor: "pointer" };

  return <section className="dashboard-section" id="educational-escape-room">
    <div className="dashboard-section-heading"><div><span>FEATURE 27 · GAME-BASED LEARNING</span><h2>🗝️ AI Educational Escape Room</h2><p className="section-description">Solve subject-based challenges, collect points and unlock new learning rooms.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
      {[{ label: "Challenges solved", value: `${completedCount}/${totalPuzzles}`, icon: "🧩" }, { label: "Points earned", value: points, icon: "⭐" }, { label: "Rooms unlocked", value: rooms.filter((item, i) => i === 0 || rooms.slice(0, i).every((prior) => prior.puzzles.every((_, j) => completed[`${prior.id}-${j}`]))).length, icon: "🚪" }].map((item) => <div key={item.label} style={{ ...panel, padding: 14 }}><div style={{ fontSize: 22 }}>{item.icon}</div><strong style={{ display: "block", fontSize: 25, color: "#18334f", marginTop: 5 }}>{item.value}</strong><span className="demo-note">{item.label}</span></div>)}
    </div>
    <div style={{ ...panel, marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><div><strong style={{ color: "#18334f" }}>Your escape progress</strong><p className="demo-note" style={{ margin: "4px 0 0" }}>{completedCount} of {totalPuzzles} challenges completed</p></div><strong style={{ color: "#087f8c" }}>{Math.round(completedCount / totalPuzzles * 100)}%</strong></div><div style={{ height: 10, background: "#e9f0f4", borderRadius: 20, overflow: "hidden", marginTop: 10 }}><div style={{ width: `${completedCount / totalPuzzles * 100}%`, height: "100%", background: "linear-gradient(90deg,#087f8c,#36b6a5)", transition: "width .25s" }} /></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 16 }}>{rooms.map((item, index) => { const unlocked = index === 0 || rooms.slice(0, index).every((prior) => prior.puzzles.every((_, j) => completed[`${prior.id}-${j}`])); const done = item.puzzles.every((_, j) => completed[`${item.id}-${j}`]); return <button key={item.id} type="button" onClick={() => selectRoom(index)} disabled={!unlocked} style={{ ...panel, textAlign: "left", cursor: unlocked ? "pointer" : "not-allowed", opacity: unlocked ? 1 : .55, border: roomIndex === index ? "2px solid #0b8b91" : "1px solid #e3eaf1", background: roomIndex === index ? "#f0fbfa" : "#fff" }}><div style={{ fontSize: 27 }}>{unlocked ? item.icon : "🔒"}</div><strong style={{ display: "block", color: "#18334f", marginTop: 7 }}>{item.title}</strong><span className="demo-note">{item.subject} · {done ? "Completed ✓" : unlocked ? "Unlocked" : "Locked"}</span></button>; })}</div>
    <div style={{ ...panel, background: "linear-gradient(135deg,#102b46,#17566a)", color: "#fff", border: 0 }}>
      {loading ? <p>Loading your saved game…</p> : finished ? <div style={{ textAlign: "center", padding: 18 }}><div style={{ fontSize: 48 }}>🏆</div><h3 style={{ color: "#fff", marginBottom: 5 }}>You escaped every room!</h3><p style={{ color: "#d9edf1" }}>You solved all {totalPuzzles} challenges and earned {points} points.</p><button type="button" style={{ ...secondary, marginTop: 8 }} onClick={resetGame}>Play again</button></div> : <>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><span style={{ color: "#a9dce0", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>CURRENT MISSION · {room.subject.toUpperCase()}</span><h3 style={{ color: "#fff", margin: "5px 0" }}>{room.icon} {room.title}</h3></div><span style={{ background: "rgba(255,255,255,.14)", padding: "7px 11px", borderRadius: 20, fontWeight: 750 }}>Challenge {puzzleIndex + 1}/{room.puzzles.length}</span></div>
        <p style={{ color: "#d9edf1", lineHeight: 1.6 }}>{room.story}</p>
        <div style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", padding: 18, borderRadius: 12, marginTop: 14 }}><div style={{ color: "#a9dce0", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>🔐 SOLVE THE PUZZLE</div><h3 style={{ color: "#fff", lineHeight: 1.5, margin: "0 0 14px" }}>{puzzle.question}</h3><input value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitAnswer(); }} disabled={!!completed[progressKey]} placeholder="Enter your answer…" aria-label="Puzzle answer" style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 8, border: "1px solid #c8dce4", fontSize: 15 }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" style={primary} onClick={submitAnswer} disabled={!!completed[progressKey] || saving}>Check answer</button><button type="button" style={{ ...secondary, background: "#fff" }} onClick={() => setHintVisible((value) => !value)}>{hintVisible ? "Hide hint" : "💡 Get a hint"}</button>{completed[progressKey] && <button type="button" style={{ ...secondary, background: "#fff" }} onClick={nextPuzzle}>{puzzleIndex === room.puzzles.length - 1 && roomIndex === rooms.length - 1 ? "Finish escape room" : "Next challenge →"}</button>}</div>
          {hintVisible && <p style={{ color: "#fff2c7", background: "rgba(255,255,255,.1)", padding: 11, borderRadius: 8, marginTop: 12 }}>💡 Hint: {puzzle.hint}</p>}
          {feedback && <p role="status" style={{ color: feedback.startsWith("Correct") || feedback.startsWith("Room") || feedback.startsWith("Amazing") ? "#b9f4d4" : "#ffe0b8", lineHeight: 1.5, marginBottom: 0 }}>{feedback}</p>}
        </div>
      </>}
    </div>
    {message && <p role="status" className="demo-note" style={{ marginTop: 12 }}>{message}</p>}
    <div style={{ ...panel, marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><strong style={{ color: "#18334f" }}>💾 Game progress</strong><p className="demo-note" style={{ margin: "4px 0 0" }}>{currentUser ? (saving ? "Saving your progress…" : "Progress is saved privately to your Firebase account.") : "Sign in to save progress between sessions."}</p></div><button type="button" style={secondary} onClick={resetGame} disabled={saving}>Reset game</button></div>
    <p className="demo-note" style={{ marginTop: 10 }}>This learning game uses built-in questions and answer checking; it does not require an AI API or backend server. Progress is stored at <code>users/&#123;uid&#125;/escapeRoomProgress/current</code>.</p>
  </section>;
}

// FEATURE 28 — AI DEBATE ARENA
// The opponent and scoring rubric are curated/rule-based; no external AI API is called.
function AIDebateArena() {
  const topics = [
    { id: "ai-education", topic: "AI tools should be used in classrooms", pro: ["AI tutors can give learners immediate, personalised practice and explanations.", "Teachers can use AI to reduce repetitive work and spend more time supporting students.", "With clear rules and source checking, AI literacy prepares students for modern workplaces."], con: ["Over-reliance on AI can weaken independent thinking and foundational problem-solving.", "Unequal access to devices and connectivity may widen existing learning gaps.", "AI can produce inaccurate answers and expose student data if safeguards are weak."] },
    { id: "remote-work", topic: "Remote work is better than office-based work", pro: ["Remote work saves commuting time and can give people more flexibility.", "Employers can recruit talent beyond one geographic location.", "Fewer office costs can be redirected toward tools, training and employee support."], con: ["In-person collaboration can make mentoring and spontaneous problem-solving easier.", "Remote workers may experience isolation and weaker team connection.", "Some roles need secure equipment, physical presence or direct customer interaction."] },
    { id: "social-media", topic: "Social media does more harm than good", pro: ["Recommendation systems can amplify misinformation and extreme content.", "Heavy use can affect attention, sleep and self-esteem.", "Personal data collection creates privacy and safety concerns."], con: ["Social platforms help people maintain relationships across distance.", "They provide access to educational resources, communities and emergency updates.", "Creators and small businesses can reach audiences without traditional gatekeepers."] },
    { id: "renewable-energy", topic: "Governments should prioritise renewable energy", pro: ["Renewables reduce dependence on finite fuels and lower operating emissions.", "Investment can create jobs in manufacturing, installation and maintenance.", "Diversified energy sources can improve long-term energy security."], con: ["Grid storage and transmission upgrades require substantial investment.", "Intermittent generation needs reliable backup and careful planning.", "Rapid transitions can burden communities and workers dependent on fossil-fuel industries."] },
    { id: "project-assessment", topic: "Project-based assessment is better than traditional exams", pro: ["Projects show how learners apply knowledge to realistic problems.", "Teamwork, research and communication skills can be assessed alongside subject knowledge.", "Multiple milestones give students opportunities to improve from feedback."], con: ["Projects can be difficult to grade consistently across different students.", "Group work may hide unequal contributions.", "Timed exams can efficiently test individual understanding under common conditions."] }
  ];
  const [topicId, setTopicId] = useState(topics[0].id);
  const [side, setSide] = useState("pro");
  const [round, setRound] = useState(0);
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [seconds, setSeconds] = useState(120);
  const [timerRunning, setTimerRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [debateUser, setDebateUser] = useState(auth.currentUser);
  const [notice, setNotice] = useState("Choose a topic and position, then make your opening argument.");
  const user = auth.currentUser;
  const selected = topics.find((item) => item.id === topicId) || topics[0];
  const rounds = ["Opening statement", "Rebuttal", "Closing statement"];
  const opponentSide = side === "pro" ? "con" : "pro";
  const opponentPoints = selected[opponentSide];

  useEffect(() => onAuthStateChanged(auth, (nextUser) => setDebateUser(nextUser)), []);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      if (!debateUser) { setHistory([]); return; }
      try {
        const snapshot = await getDocs(collection(db, "users", debateUser.uid, "debateSessions"));
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        if (!cancelled) setHistory(rows.slice(0, 10));
      } catch (error) { console.error("Debate history load failed:", error); if (!cancelled) setNotice("Could not load saved debate history. Check your Firestore rules."); }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [debateUser?.uid]);

  useEffect(() => {
    if (!timerRunning || seconds <= 0) return undefined;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning, seconds]);

  function resetDebate(nextTopic = topicId, nextSide = side) {
    setTopicId(nextTopic); setSide(nextSide); setRound(0); setDraft(""); setTranscript([]);
    setSeconds(120); setTimerRunning(false); setNotice("New debate ready. Build a clear claim and support it with reasons or examples.");
  }

  function submitArgument() {
    const text = draft.trim();
    if (!text) { setNotice("Write your argument before submitting."); return; }
    if (round >= rounds.length) return;
    const opponentReply = opponentPoints[round];
    setTranscript((current) => [...current, { round: rounds[round], student: text, opponent: opponentReply }]);
    setDraft(""); setTimerRunning(false); setSeconds(120);
    setRound((value) => value + 1);
    setNotice("Your argument and the opponent's counterpoint have been added to the debate.");
  }

  const allStudentText = transcript.map((item) => item.student).join(" ");
  const wordCount = allStudentText.trim() ? allStudentText.trim().split(/\s+/).length : 0;
  const reasoningTerms = ["because", "therefore", "for example", "evidence", "however", "although", "data", "impact", "result", "first", "second"];
  const reasoningCount = reasoningTerms.filter((term) => allStudentText.toLowerCase().includes(term)).length;
  const score = Math.min(100, Math.round(Math.min(wordCount / 120, 1) * 35 + Math.min(reasoningCount / 5, 1) * 35 + (transcript.length / 3) * 30));
  const feedback = score >= 80 ? "Strong participation and structure. Refine your evidence and anticipate counterarguments." : score >= 50 ? "Good start. Add specific examples, evidence and clearer links between claims and conclusions." : "Develop each claim with a reason and a concrete example. Complete all three rounds for a fuller reflection.";

  async function saveDebate() {
    if (!user) { setNotice("Please sign in to save your debate privately."); return; }
    if (!transcript.length) { setNotice("Complete at least one round before saving."); return; }
    setSaving(true);
    try {
      const data = { topic: selected.topic, topicId, side, score, wordCount, rounds: transcript, createdAt: serverTimestamp() };
      const saved = await addDoc(collection(db, "users", user.uid, "debateSessions"), data);
      setHistory((current) => [{ id: saved.id, ...data, createdAt: new Date() }, ...current].slice(0, 10));
      setNotice("Debate saved to your private Firebase account.");
    } catch (error) { console.error("Saving debate failed:", error); setNotice(`Could not save debate: ${error.message || "Check Firestore rules."}`); }
    finally { setSaving(false); }
  }

  return <section className="dashboard-section" id="ai-debate-arena">
    <div className="dashboard-section-heading"><div><span>COMMUNICATION & CRITICAL THINKING</span><h2>🏆 AI Debate Arena</h2><p>Practise structured arguments, respond to counterpoints and reflect on your communication skills.</p></div></div>
    <div className="workspace-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14 }}>
        <label style={{ display: "grid", gap: 6, color: "#18334f", fontWeight: 700 }}>Debate topic<select value={topicId} onChange={(e) => resetDebate(e.target.value, side)} style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 9, background: "white" }}>{topics.map((item) => <option key={item.id} value={item.id}>{item.topic}</option>)}</select></label>
        <label style={{ display: "grid", gap: 6, color: "#18334f", fontWeight: 700 }}>Your position<select value={side} onChange={(e) => resetDebate(topicId, e.target.value)} style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 9, background: "white" }}><option value="pro">For / Agree</option><option value="con">Against / Disagree</option></select></label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button type="button" className="secondary-action" onClick={() => { const choices = topics.filter((item) => item.id !== topicId); const next = choices[Math.floor(Math.random() * choices.length)]; resetDebate(next.id, side); }}>🎲 Generate random topic</button></div>
      <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#f2f8fb" }}><div style={{ color: "#139b91", fontSize: 12, fontWeight: 800 }}>YOUR TASK</div><h3 style={{ color: "#18334f", margin: "6px 0" }}>{selected.topic}</h3><p style={{ color: "#526174", margin: 0 }}>You are arguing <strong>{side === "pro" ? "FOR" : "AGAINST"}</strong> this statement. Support your position with reasons, examples and evidence.</p></div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 16 }}>
      <div className="workspace-card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><h3 style={{ color: "#18334f", margin: 0 }}>🎙️ Your debate round</h3><strong style={{ color: seconds === 0 ? "#dc2626" : "#139b91", fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong></div>
        <p className="demo-note">{round < 3 ? `Round ${round + 1} of 3 · ${rounds[round]}` : "All rounds completed"}</p>
        {round < 3 ? <><textarea rows={7} maxLength={4000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="State your claim, explain why it matters, and add an example or evidence..." style={{ width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 9, resize: "vertical", lineHeight: 1.6 }} /><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><button type="button" className="primary-action" onClick={submitArgument}>Submit {rounds[round]}</button><button type="button" className="secondary-action" onClick={() => setTimerRunning((v) => !v)}>{timerRunning ? "Pause timer" : "Start 2-minute timer"}</button><button type="button" className="secondary-action" onClick={() => { setSeconds(120); setTimerRunning(false); }}>Reset timer</button></div></> : <div style={{ padding: 16, background: "#effaf8", borderRadius: 10, color: "#087f75" }}><strong>Debate completed!</strong><p style={{ marginBottom: 0 }}>Review your arguments and save this practice session to your history.</p></div>}
        <p role="status" className="demo-note" style={{ marginTop: 12 }}>{notice}</p>
      </div>
      <div className="workspace-card" style={{ padding: 20 }}>
        <h3 style={{ color: "#18334f", marginTop: 0 }}>🧠 Opponent counterpoints</h3><p className="demo-note">Prepared counterarguments for the opposite position. Use them to practise rebuttal; this is not a live generative AI chat.</p>
        {transcript.length ? transcript.map((item, index) => <div key={`${item.round}-${index}`} style={{ padding: 12, borderRadius: 9, background: "#f7fafc", marginTop: 10 }}><strong style={{ color: "#18334f" }}>{item.round}</strong><p style={{ color: "#526174", whiteSpace: "pre-wrap" }}><strong>Your argument:</strong> {item.student}</p><p style={{ color: "#087f75", whiteSpace: "pre-wrap", marginBottom: 0 }}><strong>Opponent:</strong> {item.opponent}</p></div>) : <p className="demo-note">Your opponent's counterpoints will appear here after you submit each round.</p>}
      </div>
    </div>
    <div className="workspace-card" style={{ padding: 20, marginTop: 16 }}>
      <h3 style={{ color: "#18334f", marginTop: 0 }}>📊 Communication score</h3><div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}><strong style={{ fontSize: 42, color: "#139b91" }}>{score}<span style={{ fontSize: 16 }}>/100</span></strong><div style={{ flex: "1 1 220px" }}><div style={{ height: 10, background: "#e5edf3", borderRadius: 20, overflow: "hidden" }}><div style={{ width: `${score}%`, height: "100%", background: "#139b91", borderRadius: 20 }} /></div><p className="demo-note" style={{ marginBottom: 0, marginTop: 8 }}>{feedback}</p></div></div>
      <p className="demo-note" style={{ marginTop: 12 }}>Rubric uses participation (rounds completed), response length and reasoning cues. It is a practice indicator, not an AI judgement of truth or debate quality.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" className="primary-action" onClick={saveDebate} disabled={saving || !transcript.length}>{saving ? "Saving..." : "Save debate to Firebase"}</button><button type="button" className="secondary-action" onClick={() => resetDebate()}>Start new debate</button><button type="button" className="secondary-action" onClick={() => window.print()}>Print / Save PDF</button></div>
    </div>
    <div className="workspace-card" style={{ padding: 20, marginTop: 16 }}><h3 style={{ color: "#18334f", marginTop: 0 }}>📚 Your debate history</h3>{history.length ? <div style={{ display: "grid", gap: 9 }}>{history.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: 12, background: "#f7fafc", borderRadius: 9 }}><div><strong style={{ color: "#18334f" }}>{item.topic}</strong><div className="demo-note">Position: {item.side === "pro" ? "For" : "Against"} · {item.rounds?.length || 0} rounds</div></div><strong style={{ color: "#139b91" }}>{item.score ?? 0}/100</strong></div>)}</div> : <p className="demo-note">No saved debates yet. Complete a round and save your first practice session.</p>}<p className="demo-note" style={{ marginTop: 12 }}>Saved privately at <code>users/&#123;uid&#125;/debateSessions</code>. No backend server or extra package is required.</p></div>
  </section>;
}

function Dashboard({ onBack }) {
  const [activeSection, setActiveSection] = useState("dashboard");

  // COURSE STATES
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  // Student Courses panel filter: controls which published faculty notes are shown.
  const [courseNotesLevelFilter, setCourseNotesLevelFilter] = useState("all");
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Bring each newly opened learning panel into view so students can see it immediately.
  useEffect(() => {
    if (!selectedCourse) return;
    requestAnimationFrame(() => {
      document.getElementById("course-details-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedLesson) return;
    requestAnimationFrame(() => {
      document.getElementById("selected-lesson-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedLesson]);

  useEffect(() => {
    if (!selectedTopic) return;
    requestAnimationFrame(() => {
      document.getElementById("topic-learning-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedTopic]);
  const [completedLessons, setCompletedLessons] = useState({});
  const [certificates, setCertificates] = useState([]);
  const [certificateMessage, setCertificateMessage] = useState("");
  const [certificateIssuing, setCertificateIssuing] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // STUDY PLANNER STATES
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("Today");
  const [taskCourse, setTaskCourse] = useState("Python Programming");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [taskDuration, setTaskDuration] = useState("30");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskError, setTaskError] = useState("");

  // WEEKLY STUDY TIMETABLE STATES
  const timetableDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const todayDayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [sessionSubject, setSessionSubject] = useState("");
  const [sessionDay, setSessionDay] = useState(todayDayName);
  const [sessionStart, setSessionStart] = useState("09:00");
  const [sessionEnd, setSessionEnd] = useState("10:00");
  const [sessionSaving, setSessionSaving] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [timetableMessage, setTimetableMessage] = useState("");
  const [timetableError, setTimetableError] = useState("");

  // ANNOUNCEMENTS & STUDENT NOTIFICATION READ STATUS
  const [announcementReads, setAnnouncementReads] = useState({});
  const [announcementReadLoading, setAnnouncementReadLoading] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);

  // STUDY REMINDERS & IN-APP NOTIFICATION CENTER STATES
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderCategory, setReminderCategory] = useState("Study Session");
  const [reminderDate, setReminderDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [reminderFilter, setReminderFilter] = useState("upcoming");
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderError, setReminderError] = useState("");

  // LEARNING GOALS & STUDY STREAKS
  const [learningGoalsLoading, setLearningGoalsLoading] = useState(true);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(60);
  const [weeklyGoalMinutes, setWeeklyGoalMinutes] = useState(300);
  const [studyActivity, setStudyActivity] = useState([]);
  const [studyMinutesInput, setStudyMinutesInput] = useState("30");
  const [goalSaving, setGoalSaving] = useState(false);
  const [activitySaving, setActivitySaving] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [goalError, setGoalError] = useState("");

  // ASSIGNMENT MANAGEMENT & SUBMISSIONS
  const [assignments, setAssignments] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentCourse, setAssignmentCourse] = useState("Python Programming");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [assignmentMarks, setAssignmentMarks] = useState("100");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [submissionFiles, setSubmissionFiles] = useState({});
  const [submissionSavingId, setSubmissionSavingId] = useState(null);
  const [gradingDrafts, setGradingDrafts] = useState({});

  // COURSE DISCUSSION FORUM
  const [discussions, setDiscussions] = useState([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
  const [discussionCourse, setDiscussionCourse] = useState("Python Programming");
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [discussionSearch, setDiscussionSearch] = useState("");
  const [discussionFilter, setDiscussionFilter] = useState("all");
  const [discussionSaving, setDiscussionSaving] = useState(false);
  const [discussionError, setDiscussionError] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [expandedDiscussionId, setExpandedDiscussionId] = useState(null);
  const [discussionReplies, setDiscussionReplies] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replySavingId, setReplySavingId] = useState(null);

  // DISCUSSION FORUM ACTIONS
  async function createDiscussion(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { setDiscussionError("Please sign in to ask a question."); return; }
    if (!discussionTitle.trim() || !discussionBody.trim()) { setDiscussionError("Enter both a question title and details."); return; }
    try {
      setDiscussionSaving(true); setDiscussionError(""); setDiscussionMessage("");
      const payload = {
        course: discussionCourse, title: discussionTitle.trim(), body: discussionBody.trim(),
        authorId: user.uid, authorName: profile.name || user.displayName || "Student",
        authorEmail: user.email || "", authorRole: accountRole, status: "open",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      };
      const saved = await addDoc(collection(db, "courseDiscussions"), payload);
      setDiscussions((items) => [{ ...payload, id: saved.id, createdAt: new Date() }, ...items]);
      setDiscussionTitle(""); setDiscussionBody(""); setDiscussionMessage("Your question was posted successfully.");
    } catch (err) {
      console.error("Discussion create error:", err);
      setDiscussionError("Could not post your question. Check the Course Discussion Firestore rules.");
    } finally { setDiscussionSaving(false); }
  }

  async function toggleDiscussionReplies(discussion) {
    if (expandedDiscussionId === discussion.id) { setExpandedDiscussionId(null); return; }
    setExpandedDiscussionId(discussion.id);
    if (discussionReplies[discussion.id]) return;
    try {
      const snap = await getDocs(collection(db, "courseDiscussions", discussion.id, "replies"));
      const replies = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      replies.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setDiscussionReplies((current) => ({ ...current, [discussion.id]: replies }));
    } catch (err) {
      console.error("Discussion replies loading error:", err);
      setDiscussionError("Could not load replies. Check your Firestore rules.");
    }
  }

  async function postDiscussionReply(discussion) {
    const user = auth.currentUser; const body = String(replyDrafts[discussion.id] || "").trim();
    if (!user) { setDiscussionError("Please sign in to reply."); return; }
    if (!body) { setDiscussionError("Write a reply before posting."); return; }
    try {
      setReplySavingId(discussion.id); setDiscussionError("");
      const payload = { body, authorId: user.uid, authorName: profile.name || user.displayName || "Student", authorEmail: user.email || "", authorRole: accountRole, createdAt: serverTimestamp() };
      const saved = await addDoc(collection(db, "courseDiscussions", discussion.id, "replies"), payload);
      setDiscussionReplies((current) => ({ ...current, [discussion.id]: [...(current[discussion.id] || []), { ...payload, id: saved.id, createdAt: new Date() }] }));
      setReplyDrafts((current) => ({ ...current, [discussion.id]: "" }));
    } catch (err) {
      console.error("Discussion reply error:", err);
      setDiscussionError("Could not post your reply. Check the Course Discussion Firestore rules.");
    } finally { setReplySavingId(null); }
  }

  async function toggleDiscussionResolved(discussion) {
    if (!auth.currentUser || (discussion.authorId !== auth.currentUser.uid && !["faculty", "admin"].includes(accountRole))) return;
    const nextStatus = discussion.status === "resolved" ? "open" : "resolved";
    try {
      await updateDoc(doc(db, "courseDiscussions", discussion.id), { status: nextStatus, updatedAt: serverTimestamp() });
      setDiscussions((items) => items.map((item) => item.id === discussion.id ? { ...item, status: nextStatus } : item));
    } catch (err) { console.error("Discussion status update error:", err); setDiscussionError("Could not update this question. Check your Firestore rules."); }
  }

  // FEATURE 18 — STUDY GROUPS & PEER COLLABORATION
  const [studyGroups, setStudyGroups] = useState([]);
  const [studyGroupsLoading, setStudyGroupsLoading] = useState(true);
  const [studyGroupTitle, setStudyGroupTitle] = useState("");
  const [studyGroupCourse, setStudyGroupCourse] = useState("Python Programming");
  const [studyGroupDescription, setStudyGroupDescription] = useState("");
  const [studyGroupSaving, setStudyGroupSaving] = useState(false);
  const [studyGroupMessage, setStudyGroupMessage] = useState("");
  const [studyGroupError, setStudyGroupError] = useState("");
  const [selectedStudyGroup, setSelectedStudyGroup] = useState(null);
  const [studyGroupMessages, setStudyGroupMessages] = useState([]);
  const [studyGroupMessagesLoading, setStudyGroupMessagesLoading] = useState(false);
  const [studyGroupMessageDraft, setStudyGroupMessageDraft] = useState("");
  const [studyGroupMessageSaving, setStudyGroupMessageSaving] = useState(false);
  // FEATURE 29 — GROUP COLLABORATION EXTENSIONS
  const [studyGroupJoinCode, setStudyGroupJoinCode] = useState("");
  const [studyGroupGoalDraft, setStudyGroupGoalDraft] = useState("");
  const [studyGroupTaskDraft, setStudyGroupTaskDraft] = useState("");
  const [studyGroupTaskAssignee, setStudyGroupTaskAssignee] = useState("");

  function makeStudyGroupCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function joinStudyGroupByCode(event) {
    event.preventDefault();
    const code = studyGroupJoinCode.trim().toUpperCase();
    if (!code) return;
    const match = studyGroups.find((group) => String(group.groupCode || "").toUpperCase() === code);
    if (!match) { setStudyGroupError("No study group found for that code. Check the code and try again."); return; }
    await joinStudyGroup(match);
    setStudyGroupJoinCode("");
  }

  async function updateStudyGroupWorkspace(patch, successMessage) {
    const user = auth.currentUser;
    if (!user || !selectedStudyGroup || !(selectedStudyGroup.memberIds || []).includes(user.uid)) {
      setStudyGroupError("Join a study group before updating its shared workspace."); return false;
    }
    try {
      setStudyGroupError("");
      const updatedFields = { ...patch, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "studyGroups", selectedStudyGroup.id), updatedFields);
      const updated = { ...selectedStudyGroup, ...patch };
      setSelectedStudyGroup(updated);
      setStudyGroups((items) => items.map((item) => item.id === updated.id ? updated : item));
      setStudyGroupMessage(successMessage);
      return true;
    } catch (err) {
      console.error("Study group workspace update error:", err);
      setStudyGroupError("Could not update the shared workspace. Check your Firestore rules.");
      return false;
    }
  }

  async function addStudyGroupGoal(event) {
    event.preventDefault();
    const title = studyGroupGoalDraft.trim();
    if (!title || !selectedStudyGroup) return;
    const goals = [...(selectedStudyGroup.goals || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title, done: false, createdBy: auth.currentUser?.uid || "", createdByName: profile.name || auth.currentUser?.displayName || "Student" }];
    if (await updateStudyGroupWorkspace({ goals }, "Shared study goal added.")) setStudyGroupGoalDraft("");
  }

  async function toggleStudyGroupGoal(goalId) {
    const goals = (selectedStudyGroup?.goals || []).map((goal) => goal.id === goalId ? { ...goal, done: !goal.done } : goal);
    await updateStudyGroupWorkspace({ goals }, "Study goal updated.");
  }

  async function addStudyGroupTask(event) {
    event.preventDefault();
    const title = studyGroupTaskDraft.trim();
    if (!title || !selectedStudyGroup) return;
    const tasks = [...(selectedStudyGroup.tasks || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, title, assigneeId: studyGroupTaskAssignee || "", assigneeName: selectedStudyGroup.memberNames?.[studyGroupTaskAssignee] || "Anyone", done: false, createdBy: auth.currentUser?.uid || "", createdAt: new Date().toISOString() }];
    if (await updateStudyGroupWorkspace({ tasks }, "Shared task added.")) { setStudyGroupTaskDraft(""); setStudyGroupTaskAssignee(""); }
  }

  async function toggleStudyGroupTask(taskId) {
    const tasks = (selectedStudyGroup?.tasks || []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task);
    await updateStudyGroupWorkspace({ tasks }, "Task progress updated.");
  }

  async function loadStudyGroups() {
    try {
      setStudyGroupsLoading(true);
      const snapshot = await getDocs(collection(db, "studyGroups"));
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setStudyGroups(items);
      if (selectedStudyGroup) {
        const updated = items.find((item) => item.id === selectedStudyGroup.id);
        if (updated) setSelectedStudyGroup(updated);
      }
      setStudyGroupError("");
    } catch (err) {
      console.error("Study groups loading error:", err);
      setStudyGroupError("Could not load study groups. Check the Study Groups Firestore rules.");
    } finally {
      setStudyGroupsLoading(false);
    }
  }

  async function createStudyGroup(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { setStudyGroupError("Please sign in to create a study group."); return; }
    if (!studyGroupTitle.trim() || !studyGroupDescription.trim()) {
      setStudyGroupError("Enter a group name and description."); return;
    }
    try {
      setStudyGroupSaving(true); setStudyGroupError(""); setStudyGroupMessage("");
      const payload = {
        title: studyGroupTitle.trim(),
        course: studyGroupCourse,
        description: studyGroupDescription.trim(),
        createdBy: user.uid,
        createdByName: profile.name || user.displayName || "Student",
        memberIds: [user.uid],
        memberNames: { [user.uid]: profile.name || user.displayName || "Student" },
        groupCode: makeStudyGroupCode(),
        goals: [],
        tasks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const saved = await addDoc(collection(db, "studyGroups"), payload);
      const created = { ...payload, id: saved.id, createdAt: new Date() };
      setStudyGroups((items) => [created, ...items]);
      setSelectedStudyGroup(created);
      setStudyGroupTitle(""); setStudyGroupDescription("");
      setStudyGroupMessage("Your study group has been created.");
    } catch (err) {
      console.error("Study group creation error:", err);
      setStudyGroupError("Could not create the group. Check the Study Groups Firestore rules.");
    } finally { setStudyGroupSaving(false); }
  }

  async function joinStudyGroup(group) {
    const user = auth.currentUser;
    if (!user) { setStudyGroupError("Please sign in to join a study group."); return; }
    const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
    if (memberIds.includes(user.uid)) { setSelectedStudyGroup(group); return; }
    const memberName = profile.name || user.displayName || "Student";
    try {
      setStudyGroupError(""); setStudyGroupMessage("");
      const nextMemberIds = [...memberIds, user.uid];
      const nextMemberNames = { ...(group.memberNames || {}), [user.uid]: memberName };
      await updateDoc(doc(db, "studyGroups", group.id), {
        memberIds: nextMemberIds, memberNames: nextMemberNames, updatedAt: serverTimestamp()
      });
      const updated = { ...group, memberIds: nextMemberIds, memberNames: nextMemberNames };
      setStudyGroups((items) => items.map((item) => item.id === group.id ? updated : item));
      setSelectedStudyGroup(updated);
      setStudyGroupMessage(`You joined ${group.title}.`);
    } catch (err) {
      console.error("Study group join error:", err);
      setStudyGroupError("Could not join this group. Check the Study Groups Firestore rules.");
    }
  }

  async function leaveStudyGroup(group) {
    const user = auth.currentUser;
    if (!user || group.createdBy === user.uid) return;
    try {
      const nextMemberIds = (group.memberIds || []).filter((id) => id !== user.uid);
      const nextMemberNames = { ...(group.memberNames || {}) };
      delete nextMemberNames[user.uid];
      await updateDoc(doc(db, "studyGroups", group.id), {
        memberIds: nextMemberIds, memberNames: nextMemberNames, updatedAt: serverTimestamp()
      });
      const updated = { ...group, memberIds: nextMemberIds, memberNames: nextMemberNames };
      setStudyGroups((items) => items.map((item) => item.id === group.id ? updated : item));
      setSelectedStudyGroup(null); setStudyGroupMessages([]);
      setStudyGroupMessage("You left the study group.");
    } catch (err) {
      console.error("Study group leave error:", err);
      setStudyGroupError("Could not leave this group. Check the Study Groups Firestore rules.");
    }
  }

  async function loadStudyGroupMessages(group) {
    const user = auth.currentUser;
    if (!user || !(group.memberIds || []).includes(user.uid)) {
      setStudyGroupMessages([]); return;
    }
    try {
      setStudyGroupMessagesLoading(true);
      const snapshot = await getDocs(collection(db, "studyGroups", group.id, "messages"));
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setStudyGroupMessages(items);
    } catch (err) {
      console.error("Study group messages loading error:", err);
      setStudyGroupError("Could not load group messages. Check the Study Groups Firestore rules.");
    } finally { setStudyGroupMessagesLoading(false); }
  }

  async function postStudyGroupMessage(event) {
    event.preventDefault();
    const user = auth.currentUser;
    const body = studyGroupMessageDraft.trim();
    if (!user || !selectedStudyGroup || !(selectedStudyGroup.memberIds || []).includes(user.uid)) {
      setStudyGroupError("Join this study group before posting a message."); return;
    }
    if (!body) return;
    try {
      setStudyGroupMessageSaving(true); setStudyGroupError("");
      const payload = {
        body,
        authorId: user.uid,
        authorName: profile.name || user.displayName || "Student",
        createdAt: serverTimestamp()
      };
      const saved = await addDoc(collection(db, "studyGroups", selectedStudyGroup.id, "messages"), payload);
      setStudyGroupMessages((items) => [...items, { ...payload, id: saved.id, createdAt: new Date() }]);
      setStudyGroupMessageDraft("");
    } catch (err) {
      console.error("Study group message error:", err);
      setStudyGroupError("Could not send your message. Check the Study Groups Firestore rules.");
    } finally { setStudyGroupMessageSaving(false); }
  }

  useEffect(() => { loadStudyGroups(); }, []);
  useEffect(() => {
    if (selectedStudyGroup) loadStudyGroupMessages(selectedStudyGroup);
  }, [selectedStudyGroup?.id]);

  // FEATURE 19 — PEER LEARNING CHALLENGES
  const [selectedPeerChallengeId, setSelectedPeerChallengeId] = useState(peerLearningChallenges[0].id);
  const [peerChallengeAnswers, setPeerChallengeAnswers] = useState({});
  const [peerChallengeSubmissions, setPeerChallengeSubmissions] = useState([]);
  const [peerChallengeLoading, setPeerChallengeLoading] = useState(true);
  const [peerChallengeSaving, setPeerChallengeSaving] = useState(false);
  const [peerChallengeError, setPeerChallengeError] = useState("");
  const [peerChallengeMessage, setPeerChallengeMessage] = useState("");
  const [peerChallengeResult, setPeerChallengeResult] = useState(null);
  const selectedPeerChallenge = peerLearningChallenges.find((item) => item.id === selectedPeerChallengeId) || peerLearningChallenges[0];

  async function loadPeerChallengeSubmissions() {
    try {
      setPeerChallengeLoading(true);
      const snapshot = await getDocs(collection(db, "challengeSubmissions"));
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPeerChallengeSubmissions(items);
      setPeerChallengeError("");
    } catch (err) {
      console.error("Peer challenge loading error:", err);
      setPeerChallengeError("Could not load challenge scores. Check the Challenge Submissions Firestore rules.");
    } finally { setPeerChallengeLoading(false); }
  }

  async function submitPeerChallenge(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { setPeerChallengeError("Please sign in to submit a challenge."); return; }
    const questions = selectedPeerChallenge.questions;
    if (questions.some((question) => peerChallengeAnswers[question.id] === undefined)) {
      setPeerChallengeError("Please answer every question before submitting."); return;
    }
    const correctCount = questions.filter((question) => Number(peerChallengeAnswers[question.id]) === question.answer).length;
    const score = Math.round((correctCount / questions.length) * selectedPeerChallenge.points);
    try {
      setPeerChallengeSaving(true); setPeerChallengeError(""); setPeerChallengeMessage("");
      const payload = {
        studentId: user.uid,
        studentName: profile.name || user.displayName || user.email || "Student",
        challengeId: selectedPeerChallenge.id,
        challengeTitle: selectedPeerChallenge.title,
        course: selectedPeerChallenge.course,
        score,
        totalPoints: selectedPeerChallenge.points,
        correctCount,
        questionCount: questions.length,
        createdAt: serverTimestamp()
      };
      const saved = await addDoc(collection(db, "challengeSubmissions"), payload);
      setPeerChallengeSubmissions((items) => [{ ...payload, id: saved.id, createdAt: new Date() }, ...items]);
      setPeerChallengeResult({ score, totalPoints: selectedPeerChallenge.points, correctCount, questionCount: questions.length });
      setPeerChallengeMessage("Your score has been saved. Great work!");
    } catch (err) {
      console.error("Peer challenge submission error:", err);
      setPeerChallengeError("Could not save your score. Check the Challenge Submissions Firestore rules.");
    } finally { setPeerChallengeSaving(false); }
  }

  function choosePeerChallenge(challengeId) {
    setSelectedPeerChallengeId(challengeId);
    setPeerChallengeAnswers({});
    setPeerChallengeResult(null);
    setPeerChallengeMessage("");
    setPeerChallengeError("");
  }

  const peerLeaderboard = Object.values(peerChallengeSubmissions.reduce((best, item) => {
    const key = `${item.challengeId || "unknown"}_${item.studentId || item.studentName || item.id}`;
    if (!best[key] || Number(item.score || 0) > Number(best[key].score || 0)) best[key] = item;
    return best;
  }, {})).sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 10);

  useEffect(() => { loadPeerChallengeSubmissions(); }, []);

  // FLASHCARD STATES
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(true);
  const [flashcardSaving, setFlashcardSaving] = useState(false);
  const [flashcardError, setFlashcardError] = useState("");
  const [flashcardMessage, setFlashcardMessage] = useState("");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");

  // SUMMARY STATES
  const [noteText, setNoteText] = useState("");
  const [summary, setSummary] = useState("");

  // STUDY MATERIALS LIBRARY STATES
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialCourse, setMaterialCourse] = useState("Python Programming");
  const [materialContent, setMaterialContent] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialMessage, setMaterialMessage] = useState("");
  const [materialError, setMaterialError] = useState("");
  const [materialSaving, setMaterialSaving] = useState(false);
  const [publishedCourseContent, setPublishedCourseContent] = useState([]);

  // FEATURE 14 — FILES AND VIDEO LINKS IN THE SHARED LEARNING RESOURCES LIBRARY
  const [learningResources, setLearningResources] = useState([]);
  const [learningResourcesLoading, setLearningResourcesLoading] = useState(true);
  const [learningResourceTitle, setLearningResourceTitle] = useState("");
  const [learningResourceCourse, setLearningResourceCourse] = useState("Python Programming");
  const [learningResourceSubject, setLearningResourceSubject] = useState("");
  const [learningResourceLevel, setLearningResourceLevel] = useState("Beginner");
  const [learningResourceLevelFilter, setLearningResourceLevelFilter] = useState("all");
  const [learningResourceDescription, setLearningResourceDescription] = useState("");
  const [learningResourceType, setLearningResourceType] = useState("file");
  const [learningResourceUrl, setLearningResourceUrl] = useState("");
  const [learningResourceFile, setLearningResourceFile] = useState(null);
  const [learningResourceStatus, setLearningResourceStatus] = useState("published");
  const [learningResourceSearch, setLearningResourceSearch] = useState("");
  const [learningResourceCourseFilter, setLearningResourceCourseFilter] = useState("all");
  const [learningResourceMessage, setLearningResourceMessage] = useState("");
  const [learningResourceError, setLearningResourceError] = useState("");
  const [learningResourceSaving, setLearningResourceSaving] = useState(false);
  const [editingLearningResourceId, setEditingLearningResourceId] = useState(null);

  // ASSIGNMENT ACTIONS
  async function saveAssignment(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !["faculty", "admin"].includes(accountRole)) { setAssignmentError("Only approved faculty or admin accounts can create assignments."); return; }
    if (!assignmentTitle.trim() || !assignmentDescription.trim() || !assignmentDueDate || Number(assignmentMarks) < 1) { setAssignmentError("Complete all fields and enter valid marks."); return; }
    const payload = { title: assignmentTitle.trim(), course: assignmentCourse, description: assignmentDescription.trim(), dueDate: assignmentDueDate, totalMarks: Number(assignmentMarks), status: "published", createdBy: user.uid, createdByEmail: user.email || "", updatedAt: serverTimestamp() };
    try {
      setAssignmentSaving(true); setAssignmentError(""); setAssignmentMessage("");
      if (editingAssignmentId) {
        await updateDoc(doc(db, "assignments", editingAssignmentId), payload);
        setAssignments((items) => items.map((item) => item.id === editingAssignmentId ? { ...item, ...payload } : item));
        setAssignmentMessage("Assignment updated successfully.");
      } else {
        payload.createdAt = serverTimestamp();
        const saved = await addDoc(collection(db, "assignments"), payload);
        setAssignments((items) => [...items, { ...payload, id: saved.id }].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))));
        setAssignmentMessage("Assignment published for students.");
      }
      setAssignmentTitle(""); setAssignmentDescription(""); setAssignmentDueDate(new Date().toLocaleDateString("en-CA")); setAssignmentMarks("100"); setEditingAssignmentId(null);
    } catch (err) { console.error("Assignment save error:", err); setAssignmentError("Could not save assignment. Check Firestore rules for assignments."); }
    finally { setAssignmentSaving(false); }
  }

  function editAssignment(item) {
    setEditingAssignmentId(item.id); setAssignmentTitle(item.title || ""); setAssignmentCourse(item.course || "Python Programming"); setAssignmentDescription(item.description || ""); setAssignmentDueDate(item.dueDate || new Date().toLocaleDateString("en-CA")); setAssignmentMarks(String(item.totalMarks || 100));
    setAssignmentMessage("Editing assignment. Update the details and save."); setAssignmentError(""); document.getElementById("assignment-management")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteAssignment(id) {
    if (!auth.currentUser || !["faculty", "admin"].includes(accountRole)) return;
    if (!window.confirm("Delete this assignment?")) return;
    try { await deleteDoc(doc(db, "assignments", id)); setAssignments((items) => items.filter((item) => item.id !== id)); setAssignmentMessage("Assignment deleted."); }
    catch (err) { console.error(err); setAssignmentError("Could not delete assignment. Check Firestore rules."); }
  }

  async function submitAssignment(assignment) {
    const user = auth.currentUser; const answer = String(submissionDrafts[assignment.id] || "").trim();
    if (!user) { setAssignmentError("Please sign in to submit work."); return; }
    if (!answer) { setAssignmentError("Write your answer before submitting."); return; }
    try {
      setSubmissionSavingId(assignment.id); setAssignmentError("");
      const selectedFile = submissionFiles[assignment.id];
      let attachment = assignmentSubmissions[assignment.id]?.attachment || null;
      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileRef = storageRef(getStorage(), `assignment-submissions/${assignment.id}/${user.uid}/${Date.now()}_${safeName}`);
        const uploaded = await uploadBytes(fileRef, selectedFile);
        attachment = { name: selectedFile.name, url: await getDownloadURL(uploaded.ref), contentType: selectedFile.type || "application/octet-stream" };
      }
      const payload = { studentId: user.uid, studentName: profile.name || user.displayName || "Student", studentEmail: user.email || "", answer, attachment, submittedAt: serverTimestamp(), status: "submitted" };
      await setDoc(doc(db, "assignments", assignment.id, "submissions", user.uid), payload);
      setSubmissionFiles((current) => ({ ...current, [assignment.id]: null }));
      setAssignmentSubmissions((current) => ({ ...current, [assignment.id]: { ...payload, id: user.uid } })); setAssignmentMessage("Your assignment has been submitted.");
    } catch (err) { console.error(err); setAssignmentError("Could not submit work. Check Firestore submission rules."); }
    finally { setSubmissionSavingId(null); }
  }

  async function loadAssignmentSubmissions(id) {
    try { const snap = await getDocs(collection(db, "assignments", id, "submissions")); setAssignmentSubmissions((current) => ({ ...current, [`all_${id}`]: snap.docs.map((item) => ({ id: item.id, ...item.data() })) })); }
    catch (err) { console.error(err); setAssignmentError("Could not load student submissions. Check Firestore rules."); }
  }

  async function gradeAssignment(assignment, submission) {
    const user = auth.currentUser; if (!user || !["faculty", "admin"].includes(accountRole)) return;
    const key = `${assignment.id}_${submission.id}`; const draft = gradingDrafts[key] || {};
    const score = Number(draft.score);
    if (!Number.isFinite(score) || score < 0 || score > Number(assignment.totalMarks || 100)) { setAssignmentError(`Enter a mark from 0 to ${assignment.totalMarks || 100}.`); return; }
    try {
      await updateDoc(doc(db, "assignments", assignment.id, "submissions", submission.id), { score, feedback: String(draft.feedback || "").trim(), status: "graded", gradedAt: serverTimestamp(), gradedBy: user.uid });
      setAssignmentMessage(`Submission graded: ${score}/${assignment.totalMarks || 100}.`);
      await loadAssignmentSubmissions(assignment.id);
    } catch (err) { console.error(err); setAssignmentError("Could not save grade. Check Firestore rules."); }
  }

  // ACCOUNT ROLE + ADMIN USER MANAGEMENT
  const [accountRole, setAccountRole] = useState("student");
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState("");
  const [adminUsersMessage, setAdminUsersMessage] = useState("");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminRoleSavingId, setAdminRoleSavingId] = useState("");
  // ATTENDANCE MANAGEMENT
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState("");
  const [attendanceStudentId, setAttendanceStudentId] = useState("");
  const [attendanceStudentName, setAttendanceStudentName] = useState("");
  const [attendanceCourse, setAttendanceCourse] = useState("Python Programming");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [attendanceStatus, setAttendanceStatus] = useState("Present");

  // STUDENT FEEDBACK & COURSE RATINGS
  const [courseFeedback, setCourseFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackCourse, setFeedbackCourse] = useState("Python Programming");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [facultyResources, setFacultyResources] = useState([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultySaving, setFacultySaving] = useState(false);
  const [facultyMessage, setFacultyMessage] = useState("");
  const [facultyError, setFacultyError] = useState("");
  const [facultyEditingId, setFacultyEditingId] = useState(null);
  const [facultyTitle, setFacultyTitle] = useState("");
  const [facultyCourse, setFacultyCourse] = useState("Python Programming");
  const [facultyType, setFacultyType] = useState("Lesson");
  const [facultyDescription, setFacultyDescription] = useState("");
  const [facultyContent, setFacultyContent] = useState("");
  const [facultyStatus, setFacultyStatus] = useState("Draft");

  // AI QUIZ STATES
  const [quizTopic, setQuizTopic] = useState("Python Programming");
  const [quizNotes, setQuizNotes] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [quiz, setQuiz] = useState([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [answers, setAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizSaveMessage, setQuizSaveMessage] = useState("");
  const [quizHistory, setQuizHistory] = useState([]);
  const [quizHistoryLoading, setQuizHistoryLoading] = useState(true);

  // LOAD SAVED QUIZ RESULTS FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setQuizHistory([]);
        setQuizHistoryLoading(false);
        return;
      }

      try {
        setQuizHistoryLoading(true);
        const resultsRef = collection(db, "users", currentUser.uid, "quizResults");
        const snapshot = await getDocs(resultsRef);
        const results = snapshot.docs.map((resultDoc) => ({
          id: resultDoc.id,
          ...resultDoc.data()
        }));
        results.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
        setQuizHistory(results);
      } catch (err) {
        console.error("Quiz history loading error:", err);
      } finally {
        setQuizHistoryLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // LOAD ALL COURSE PROGRESS FOR THE UNIFIED SIX-COURSE OVERVIEW
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setCompletedLessons({});
        return;
      }

      try {
        const progressRef = collection(db, "users", currentUser.uid, "courseProgress");
        const snapshot = await getDocs(progressRef);
        const progressByCourse = {};

        snapshot.docs.forEach((progressDoc) => {
          const saved = progressDoc.data();
          progressByCourse[String(saved.courseId ?? progressDoc.id)] =
            Array.isArray(saved.completedLessons) ? saved.completedLessons : [];
        });

        setCompletedLessons((current) => ({ ...current, ...progressByCourse }));
      } catch (err) {
        console.error("All-course progress loading error:", err);
      }
    });

    return () => unsubscribe();
  }, []);

  // LOAD STUDY MATERIALS FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setStudyMaterials([]);
        setMaterialsLoading(false);
        return;
      }
      try {
        setMaterialsLoading(true);
        const materialsRef = collection(db, "users", currentUser.uid, "studyMaterials");
        const snapshot = await getDocs(materialsRef);
        const savedMaterials = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        savedMaterials.sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
        setStudyMaterials(savedMaterials);
      } catch (err) {
        console.error("Study materials loading error:", err);
        setMaterialError("Could not load your study materials. Check your Firestore rules.");
      } finally {
        setMaterialsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOAD PUBLISHED FACULTY CONTENT FOR STUDENTS
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPublishedCourseContent([]);
        return;
      }
      try {
        const publishedQuery = query(
          collection(db, "courseContent"),
          where("status", "==", "published")
        );
        const snapshot = await getDocs(publishedQuery);
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        items.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setPublishedCourseContent(items);
      } catch (err) {
        console.error("Published course content loading error:", err);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOAD THIS STUDENT'S ANNOUNCEMENT READ STATUS. Announcements themselves
  // come from the existing published courseContent collection.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAnnouncementReads({}); return; }
      try {
        setAnnouncementReadLoading(true);
        const readSnapshot = await getDocs(collection(db, "users", user.uid, "announcementReads"));
        const readMap = {};
        readSnapshot.docs.forEach((item) => { readMap[item.id] = true; });
        setAnnouncementReads(readMap);
        setAnnouncementError("");
      } catch (err) {
        console.error("Announcement read status loading error:", err);
        setAnnouncementError("Could not load announcement read status. Check your Firestore rules.");
      } finally { setAnnouncementReadLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  async function markAnnouncementRead(item) {
    const user = auth.currentUser;
    if (!user) { setAnnouncementError("Please sign in to manage notifications."); return; }
    try {
      await setDoc(doc(db, "users", user.uid, "announcementReads", item.id), {
        announcementId: item.id, read: true, readAt: serverTimestamp()
      }, { merge: true });
      setAnnouncementReads((current) => ({ ...current, [item.id]: true }));
      setAnnouncementError("");
    } catch (err) {
      console.error("Mark announcement read error:", err);
      setAnnouncementError("Could not mark this announcement as read. Check your Firestore rules.");
    }
  }

  // LOAD ATTENDANCE: students see only their own records; faculty/admin see all records.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAttendanceRecords([]); return; }
      try {
        setAttendanceLoading(true);
        const recordsRef = collection(db, "attendance");
        const attendanceQuery = ["faculty", "admin"].includes(accountRole)
          ? query(recordsRef)
          : query(recordsRef, where("studentId", "==", user.uid));
        const snapshot = await getDocs(attendanceQuery);
        const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        records.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        setAttendanceRecords(records);
        setAttendanceError("");
      } catch (err) {
        console.error("Attendance loading error:", err);
        setAttendanceError("Could not load attendance. Please check the Attendance Firestore rules.");
      } finally { setAttendanceLoading(false); }
    });
    return () => unsubscribe();
  }, [accountRole]);

  // Load course feedback for course averages; faculty/admin can also review all comments.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setCourseFeedback([]); return; }
      try {
        setFeedbackLoading(true);
        // Firestore rules do not filter query results. Students must query only
        // documents whose studentId matches their authenticated Firebase UID.
        const feedbackRef = collection(db, "courseFeedback");
        const feedbackQuery = ["faculty", "admin"].includes(accountRole)
          ? query(feedbackRef)
          : query(feedbackRef, where("studentId", "==", user.uid));
        const snapshot = await getDocs(feedbackQuery);
        const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        records.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        setCourseFeedback(records);
        setFeedbackError("");
      } catch (err) {
        console.error("Course feedback loading error:", err);
        setFeedbackError("Could not load course feedback. Check the Course Feedback Firestore rules.");
      } finally { setFeedbackLoading(false); }
    });
    return () => unsubscribe();
  }, [accountRole]);

  async function saveCourseFeedback(event) {
    event.preventDefault();
    const user = auth.currentUser;
    const rating = Number(feedbackRating);
    const comment = feedbackComment.trim();
    if (!user) { setFeedbackError("Please sign in to submit feedback."); return; }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) { setFeedbackError("Choose a rating from 1 to 5 stars."); return; }
    if (!comment) { setFeedbackError("Please write a short comment about this course."); return; }
    const feedbackId = `${user.uid}_${feedbackCourse.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const existing = courseFeedback.find((item) => item.id === feedbackId);
    try {
      setFeedbackSaving(true); setFeedbackError(""); setFeedbackMessage("");
      const payload = {
        studentId: user.uid,
        studentName: profile.name || user.displayName || "Student",
        course: feedbackCourse,
        rating,
        comment,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "courseFeedback", feedbackId), payload, { merge: true });
      setCourseFeedback((items) => [{ ...existing, ...payload, id: feedbackId, updatedAt: new Date() }, ...items.filter((item) => item.id !== feedbackId)]);
      setFeedbackMessage(existing ? "Your feedback was updated successfully." : "Thank you! Your course feedback was submitted.");
      setFeedbackComment("");
    } catch (err) {
      console.error("Course feedback save error:", err);
      setFeedbackError("Could not save feedback. Check the Course Feedback Firestore rules and try again.");
    } finally { setFeedbackSaving(false); }
  }

  function editCourseFeedback(item) {
    setFeedbackCourse(item.course);
    setFeedbackRating(String(item.rating));
    setFeedbackComment(item.comment || "");
    setFeedbackMessage("You are editing your previous feedback. Submit to save your changes.");
    setFeedbackError("");
    document.getElementById("course-feedback")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteCourseFeedback(item) {
    const user = auth.currentUser;
    if (!user || item.studentId !== user.uid) return;
    try {
      await deleteDoc(doc(db, "courseFeedback", item.id));
      setCourseFeedback((items) => items.filter((entry) => entry.id !== item.id));
      setFeedbackMessage("Your feedback was deleted.");
      if (feedbackCourse === item.course) setFeedbackComment("");
    } catch (err) {
      console.error("Course feedback delete error:", err);
      setFeedbackError("Could not delete your feedback. Check your Firestore rules.");
    }
  }

  async function saveAttendance(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !["faculty", "admin"].includes(accountRole)) {
      setAttendanceError("Only faculty or admin accounts can mark attendance."); return;
    }
    if (!attendanceStudentId.trim() || !attendanceStudentName.trim() || !attendanceDate) {
      setAttendanceError("Enter the student's Firebase User UID, full name and attendance date."); return;
    }
    try {
      setAttendanceSaving(true); setAttendanceError(""); setAttendanceMessage("");
      const payload = {
        studentId: attendanceStudentId.trim(), studentName: attendanceStudentName.trim(),
        course: attendanceCourse, date: attendanceDate, status: attendanceStatus,
        markedBy: user.uid, markedByName: profile.name || user.displayName || "Faculty",
        createdAt: serverTimestamp()
      };
      const saved = await addDoc(collection(db, "attendance"), payload);
      setAttendanceRecords((current) => [{ ...payload, id: saved.id }, ...current]);
      setAttendanceMessage(`Attendance marked ${attendanceStatus.toLowerCase()} for ${attendanceStudentName.trim()}.`);
      setAttendanceStudentId(""); setAttendanceStudentName("");
    } catch (err) {
      console.error("Attendance save error:", err);
      setAttendanceError("Could not save attendance. Check your Firestore rules and try again.");
    } finally { setAttendanceSaving(false); }
  }

  // PROFILE STATES
  const [profile, setProfile] = useState({
    name: "Student",
    email: "",
    goal: "Study for 1 hour every day"
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  // FEATURE 29 — PRIVATE LEARNING & ACCESSIBILITY PREFERENCES
  const defaultLearningPreferences = {
    learningStyle: "Visual",
    preferredLanguage: "English",
    dailyStudyMinutes: "60",
    weeklyStudyHours: "5",
    studyReminders: true,
    deadlineAlerts: true,
    announcementAlerts: true,
    fontSize: "Medium",
    highContrast: false,
    reducedMotion: false,
    readingComfort: false,
    theme: "Light",
    courseUpdates: true
  };
  const [learningPreferences, setLearningPreferences] = useState(defaultLearningPreferences);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [preferencesError, setPreferencesError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setPreferencesLoading(true);
      setPreferencesMessage("");
      setPreferencesError("");
      if (!user) {
        setLearningPreferences(defaultLearningPreferences);
        setPreferencesLoading(false);
        return;
      }
      try {
        const preferencesRef = doc(db, "users", user.uid, "accessibilityPreferences", "settings");
        const snapshot = await getDoc(preferencesRef);
        setLearningPreferences({
          ...defaultLearningPreferences,
          ...(snapshot.exists() ? snapshot.data() : {})
        });
      } catch (err) {
        console.error("Learning preferences load error:", err);
        setPreferencesError("Could not load your saved preferences. Check your Firestore rules.");
      } finally {
        setPreferencesLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  function updateLearningPreference(key, value) {
    setLearningPreferences((current) => ({ ...current, [key]: value }));
    setPreferencesMessage("");
  }

  useEffect(() => {
    const root = document.documentElement;
    const theme = learningPreferences.theme || "Light";
    root.dataset.smartlearnTheme = theme === "Auto" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme.toLowerCase();
    root.style.fontSize = ({ Small: "14px", Medium: "16px", Large: "18px", "Extra large": "20px" })[learningPreferences.fontSize] || "16px";
    root.classList.toggle("smartlearn-high-contrast", Boolean(learningPreferences.highContrast));
    root.classList.toggle("smartlearn-reduced-motion", Boolean(learningPreferences.reducedMotion));
    return () => {
      delete root.dataset.smartlearnTheme;
      root.style.fontSize = "";
      root.classList.remove("smartlearn-high-contrast", "smartlearn-reduced-motion");
    };
  }, [learningPreferences.theme, learningPreferences.fontSize, learningPreferences.highContrast, learningPreferences.reducedMotion]);

  async function saveLearningPreferences() {
    const user = auth.currentUser;
    if (!user) {
      setPreferencesError("Please sign in to save your learning preferences.");
      setPreferencesMessage("");
      return;
    }
    setPreferencesSaving(true);
    setPreferencesError("");
    setPreferencesMessage("");
    try {
      const preferencesRef = doc(db, "users", user.uid, "accessibilityPreferences", "settings");
      await setDoc(preferencesRef, {
        ...learningPreferences,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setPreferencesMessage("Your learning preferences have been saved securely.");
    } catch (err) {
      console.error("Learning preferences save error:", err);
      setPreferencesError(`Could not save preferences: ${err.message || "Check your Firestore rules."}`);
    } finally {
      setPreferencesSaving(false);
    }
  }

  // Load certificates belonging to the signed-in student.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setCertificates([]);
        return;
      }
      try {
        const certificateRef = collection(db, "users", currentUser.uid, "certificates");
        const snapshot = await getDocs(certificateRef);
        setCertificates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (err) {
        console.error("Certificate loading error:", err);
      }
    });
    return () => unsubscribe();
  }, []);

  // Ask the trusted Python backend to issue (or retrieve) the certificate.
  // The Firebase ID token is sent automatically; never store it in the page.
  async function issueCourseCertificate(courseId, courseName) {
    const user = auth.currentUser;
    if (!user) {
      setCertificateMessage("Please sign in before requesting a certificate.");
      return null;
    }

    try {
      setCertificateIssuing(true);
      setCertificateMessage("Checking course completion and preparing your certificate...");

      const idToken = await user.getIdToken();
      const response = await fetch(`${API_URL}/certificates/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ course_id: String(courseId) })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || result.message || `Certificate service returned HTTP ${response.status}.`);
      }

      const serverCertificate = result.certificate && typeof result.certificate === "object"
        ? result.certificate
        : result;

      if (!serverCertificate.certificateId) {
        throw new Error("The backend response did not include a certificate ID. Check the certificate API response.");
      }

      const savedCertificate = {
        ...serverCertificate,
        id: String(courseId),
        courseId: String(serverCertificate.courseId ?? courseId),
        courseName: serverCertificate.courseName || courseName || "Course",
        studentName: serverCertificate.studentName || user.displayName || profile.name || "Student",
        completionDate: serverCertificate.completionDate || new Date().toLocaleDateString()
      };

      setCertificates((current) => [
        savedCertificate,
        ...current.filter((item) => String(item.id) !== String(courseId))
      ]);
      setCertificateMessage(`Congratulations! Your ${savedCertificate.courseName} certificate is ready with a unique ID and QR verification.`);
      return savedCertificate;
    } catch (err) {
      console.error("Certificate issuance failed:", err);
      setCertificateMessage(err.message || "Could not issue your certificate. Please try again.");
      return null;
    } finally {
      setCertificateIssuing(false);
    }
  }

  async function downloadCertificate(certificate) {
    if (!certificate) return;

    // Open the print window immediately so the browser does not block it
    // while the QR image is being generated asynchronously.
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      setCertificateMessage("Please allow pop-ups to print or save your certificate as a PDF.");
      return;
    }

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));

    try {
      const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(certificate.certificateId)}`;
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 180,
        margin: 1,
        errorCorrectionLevel: "M"
      });

      printWindow.document.write(`<!doctype html><html><head><title>SmartLearn AI Certificate</title><style>
        @page{size:landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#eef4f7;font-family:Georgia,serif;color:#18334f}
        .sheet{min-height:180mm;margin:8mm auto;padding:15mm 18mm;border:9px double #139b91;background:#fff;text-align:center;display:flex;flex-direction:column;justify-content:center;outline:2px solid #d6b66b;outline-offset:-18px;position:relative}
        .brand{font:700 18px Arial,sans-serif;letter-spacing:4px;color:#139b91}.eyebrow{margin-top:18px;letter-spacing:5px;font:700 13px Arial,sans-serif;color:#64748b}
        h1{font-size:46px;margin:12px 0;color:#18334f}p{font-size:18px;margin:10px}.name{font-size:34px;color:#139b91;font-weight:bold;margin:18px 0;border-bottom:1px solid #cbd5e1;padding-bottom:12px}
        .course{font-size:27px;font-weight:bold;margin:14px}.meta{display:flex;justify-content:space-between;align-items:center;margin:24px 8% 0;font:13px Arial,sans-serif;color:#526174}.meta strong{display:block;color:#18334f;margin-top:8px}
        .qr{position:absolute;right:28px;bottom:24px;width:112px;text-align:center;font:10px Arial,sans-serif;color:#526174}.qr img{width:92px;height:92px;display:block;margin:0 auto 5px}.verify{font:10px Arial,sans-serif;overflow-wrap:anywhere}
        @media print{body{background:#fff}.sheet{margin:0;min-height:180mm}}
      </style></head><body><main class="sheet"><div class="brand">SMARTLEARN AI</div><div class="eyebrow">CERTIFICATE OF COMPLETION</div><h1>Congratulations!</h1><p>This certificate is proudly presented to</p><div class="name">${escapeHtml(certificate.studentName)}</div><p>for successfully completing all lessons in</p><div class="course">${escapeHtml(certificate.courseName)}</div><p>and demonstrating commitment to continuous learning.</p><div class="meta"><div>COMPLETION DATE<strong>${escapeHtml(certificate.completionDate)}</strong></div><div>CERTIFICATE ID<strong>${escapeHtml(certificate.certificateId)}</strong></div></div><div class="qr"><img src="${qrDataUrl}" alt="Certificate verification QR code"/>SCAN TO VERIFY<div class="verify">${escapeHtml(verificationUrl)}</div></div></main><script>window.onload=()=>window.print();</script></body></html>`);
      printWindow.document.close();
    } catch (err) {
      console.error("Certificate QR generation failed:", err);
      printWindow.close();
      setCertificateMessage("Could not generate the certificate QR code. Check that the qrcode package is installed.");
    }
  }

  // LOAD COURSES FROM PYTHON BACKEND
  useEffect(() => {
    async function fetchCourses() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(COURSES_URL);

        if (!response.ok) {
          throw new Error("Unable to load courses.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("The backend returned an invalid course list.");
        }

        setCourses(data);
      } catch (err) {
        console.error("Course loading error:", err);

        setError(
          "Could not connect to the backend. Check that FastAPI is running at http://127.0.0.1:8000."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  // LOAD STUDENT PROFILE FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfileError("No signed-in user was found. Please log in again.");
        setProfileLoading(false);
        return;
      }

      try {
        setProfileLoading(true);
        setProfileError("");

        const profileRef = doc(db, "users", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (profileSnapshot.exists()) {
          const savedData = profileSnapshot.data();
          const savedRole = String(savedData.role || "student").toLowerCase();
          setAccountRole(savedRole);

          // Older profiles created before role-based access was introduced may
          // not have a role field. Safely initialize only the missing role as
          // student; never overwrite an existing faculty/admin assignment.
          if (!savedData.role) {
            await updateDoc(profileRef, { role: "student" });
          }

          setProfile({
            name: savedData.name || user.displayName || "Student",
            email: user.email || "",
            goal: savedData.goal || "Study for 1 hour every day"
          });
        } else {
          setAccountRole("student");
          const initialProfile = {
            name: user.displayName || "Student",
            email: user.email || "",
            role: "student",
            goal: "Study for 1 hour every day",
            createdAt: serverTimestamp()
          };

          await setDoc(profileRef, initialProfile);

          setProfile({
            name: initialProfile.name,
            email: initialProfile.email,
            goal: initialProfile.goal
          });
        }
      } catch (err) {
        console.error("Profile loading error:", err);

        setProfileError(
          "Could not load your profile. Please check your Firestore rules and internet connection."
        );
      } finally {
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // LOAD STUDY TASKS FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTasks([]);
        setTaskError("Please log in to view your study tasks.");
        setTasksLoading(false);
        return;
      }

      try {
        setTasksLoading(true);
        setTaskError("");

        const tasksRef = collection(db, "users", user.uid, "tasks");
        const snapshot = await getDocs(tasksRef);

        const savedTasks = snapshot.docs.map((taskDoc) => ({
          id: taskDoc.id,
          ...taskDoc.data()
        }));

        setTasks(savedTasks);
      } catch (err) {
        console.error("Task loading error:", err);

        setTaskError(
          "Could not load your tasks. Please check your Firestore rules and internet connection."
        );
      } finally {
        setTasksLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // LOAD WEEKLY TIMETABLE FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTimetableEntries([]);
        setTimetableError("Please log in to view your weekly timetable.");
        setTimetableLoading(false);
        return;
      }
      try {
        setTimetableLoading(true);
        setTimetableError("");
        const timetableRef = collection(db, "users", user.uid, "timetable");
        const snapshot = await getDocs(timetableRef);
        const entries = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        entries.sort((a, b) => timetableDays.indexOf(a.day) - timetableDays.indexOf(b.day) || String(a.startTime || "").localeCompare(String(b.startTime || "")));
        setTimetableEntries(entries);
      } catch (err) {
        console.error("Timetable loading error:", err);
        setTimetableError("Could not load the timetable. Check your Firestore rules and connection.");
      } finally {
        setTimetableLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOAD THIS STUDENT'S REMINDERS FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setReminders([]);
        setReminderError("Please log in to view your reminders.");
        setRemindersLoading(false);
        return;
      }
      try {
        setRemindersLoading(true);
        setReminderError("");
        const remindersRef = collection(db, "users", user.uid, "reminders");
        const snapshot = await getDocs(remindersRef);
        const savedReminders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        savedReminders.sort((a, b) => `${a.date || ""}T${a.time || ""}`.localeCompare(`${b.date || ""}T${b.time || ""}`));
        setReminders(savedReminders);
      } catch (err) {
        console.error("Reminder loading error:", err);
        setReminderError("Could not load reminders. Check your Firestore rules and connection.");
      } finally {
        setRemindersLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOAD LEARNING GOALS AND STUDY ACTIVITY FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStudyActivity([]);
        setGoalError("Please log in to view your learning goals.");
        setLearningGoalsLoading(false);
        return;
      }
      try {
        setLearningGoalsLoading(true);
        setGoalError("");
        const goalsRef = doc(db, "users", user.uid, "learningGoals", "settings");
        const goalsSnapshot = await getDoc(goalsRef);
        if (goalsSnapshot.exists()) {
          const savedGoals = goalsSnapshot.data();
          setDailyGoalMinutes(Number(savedGoals.dailyGoalMinutes) || 60);
          setWeeklyGoalMinutes(Number(savedGoals.weeklyGoalMinutes) || 300);
        }
        const activitySnapshot = await getDocs(collection(db, "users", user.uid, "studyActivity"));
        const activities = activitySnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setStudyActivity(activities);
      } catch (err) {
        console.error("Learning goals loading error:", err);
        setGoalError("Could not load learning goals. Check your Firestore rules and connection.");
      } finally {
        setLearningGoalsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOAD ASSIGNMENTS AND CURRENT STUDENT SUBMISSIONS
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAssignments([]); setAssignmentSubmissions({}); setAssignmentsLoading(false); return; }
      try {
        setAssignmentsLoading(true);
        const snap = await getDocs(collection(db, "assignments"));
        const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        rows.sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));
        setAssignments(rows);
        const own = {};
        await Promise.all(rows.map(async (item) => {
          try {
            const sub = await getDoc(doc(db, "assignments", item.id, "submissions", user.uid));
            if (sub.exists()) own[item.id] = { id: user.uid, ...sub.data() };
          } catch (err) { console.warn("Submission could not be loaded", err); }
        }));
        setAssignmentSubmissions(own);
      } catch (err) {
        console.error("Assignment loading error:", err);
        setAssignmentError("Could not load assignments. Check Firestore rules and connection.");
      } finally { setAssignmentsLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  // LOAD COURSE DISCUSSIONS
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setDiscussions([]); setDiscussionsLoading(false); return; }
      try {
        setDiscussionsLoading(true);
        const snap = await getDocs(collection(db, "courseDiscussions"));
        const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setDiscussions(rows);
      } catch (err) {
        console.error("Discussion loading error:", err);
        setDiscussionError("Could not load discussions. Check the Course Discussion Firestore rules.");
      } finally { setDiscussionsLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  // LOAD FLASHCARDS FROM FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFlashcards([]);
        setFlashcardError("Please log in to view your flashcards.");
        setFlashcardsLoading(false);
        return;
      }

      try {
        setFlashcardsLoading(true);
        setFlashcardError("");
        setFlashcardMessage("");

        const cardsRef = collection(db, "users", user.uid, "flashcards");

        let snapshot = await getDocs(cardsRef);

        if (snapshot.empty) {
          for (const card of starterFlashcards) {
            await addDoc(cardsRef, {
              front: card.front,
              back: card.back,
              createdAt: serverTimestamp()
            });
          }

          snapshot = await getDocs(cardsRef);
        }

        const savedCards = snapshot.docs.map((cardDoc) => ({
          id: cardDoc.id,
          ...cardDoc.data()
        }));

        setFlashcards(savedCards);
        setCardIndex(0);
        setCardFlipped(false);
      } catch (err) {
        console.error("Flashcard loading error:", err);

        setFlashcardError(
          "Could not load flashcards. Please check your Firestore rules and internet connection."
        );
      } finally {
        setFlashcardsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // COMPLETED TASK COUNT
  const completedTasks = tasks.filter((task) => task.done).length;

  // QUIZ SCORE
  const quizScore = useMemo(() => {
    if (!quizSubmitted || quiz.length === 0) return null;

    return quiz.filter(
      (item, index) => answers[index] === item.answer
    ).length;
  }, [answers, quiz, quizSubmitted]);

  // DERIVE LEARNING ANALYTICS FROM SAVED FIREBASE QUIZ RESULTS.
  // Older records are supported by calculating scores from their saved answers.
  const analytics = useMemo(() => {
    // Convert spelling/case variations into one consistent topic label.
    // Only merge clear aliases; different subjects (for example, AI and Python)
    // remain separate topics.
    const canonicalizeTopic = (value) => {
      const normalized = String(value || "Other")
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/programing/g, "programming")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const aliases = {
        "ai": "AI",
        "artificial intelligence": "Artificial Intelligence",
        "ai programming": "AI Programming",
        "artificial intelligence programming": "AI Programming",
        "python": "Python Programming",
        "python programming": "Python Programming",
        "java": "Java Programming",
        "java programming": "Java Programming",
        "web development": "Web Development",
        "html css": "HTML & CSS",
        "html and css": "HTML & CSS",
        "data structure": "Data Structures",
        "data structures": "Data Structures",
        "database": "Database Management",
        "database management": "Database Management"
      };

      if (aliases[normalized]) return aliases[normalized];
      if (!normalized) return "Other";
      return normalized.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    };

    const validResults = quizHistory.map((result) => {
      const savedAnswers = Array.isArray(result.answers) ? result.answers : [];
      const totalQuestions = Number(result.totalQuestions) > 0
        ? Number(result.totalQuestions)
        : savedAnswers.length;

      const calculatedScore = savedAnswers.reduce((total, answer) => {
        const selected = answer.selectedAnswerIndex;
        const correct = answer.correctAnswerIndex;
        return total + (
          Number.isInteger(selected) &&
          Number.isInteger(correct) &&
          selected === correct ? 1 : 0
        );
      }, 0);

      const score = typeof result.score === "number"
        ? result.score
        : calculatedScore;

      return {
        ...result,
        topicName: canonicalizeTopic(result.topic || result.title || "Other"),
        totalQuestions,
        safeScore: Math.max(0, Math.min(score, totalQuestions || score))
      };
    }).filter((result) => result.totalQuestions > 0);

    const totalQuestions = validResults.reduce((sum, result) => sum + result.totalQuestions, 0);
    const totalCorrect = validResults.reduce((sum, result) => sum + result.safeScore, 0);

    const topicMap = {};
    validResults.forEach((result) => {
      const key = result.topicName;
      if (!topicMap[key]) topicMap[key] = { topic: key, correct: 0, questions: 0, quizzes: 0 };
      topicMap[key].correct += result.safeScore;
      topicMap[key].questions += result.totalQuestions;
      topicMap[key].quizzes += 1;
    });

    const topics = Object.values(topicMap)
      .map((item) => ({
        ...item,
        percentage: item.questions ? Math.round((item.correct / item.questions) * 100) : 0
      }))
      .sort((a, b) => a.percentage - b.percentage);

    const now = new Date();
    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(now.getDate() - (6 - index));
      const count = validResults.filter((result) => {
        const timestamp = result.createdAt?.toDate?.()
          || (result.createdAt instanceof Date ? result.createdAt : null);
        return timestamp && timestamp.toDateString() === date.toDateString();
      }).length;
      return {
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        count
      };
    });

    const maxDaily = Math.max(1, ...weeklyActivity.map((item) => item.count));

    return {
      quizCount: validResults.length,
      totalQuestions,
      totalCorrect,
      accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      topics,
      weeklyActivity: weeklyActivity.map((item) => ({
        ...item,
        height: item.count ? Math.max(8, Math.round((item.count / maxDaily) * 100)) : 0
      }))
    };
  }, [quizHistory]);

  // NAVIGATION
  const goTo = (section) => {
    setActiveSection(section);

    document.getElementById(section)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  // GET COURSE LESSONS SAFELY
  const getCourseLessons = (course) => {
    if (Array.isArray(course?.lesson_list)) {
      return course.lesson_list;
    }

    if (Array.isArray(course?.lessons)) {
      return course.lessons;
    }

    return [];
  };

  // Support either `id` or `course_id` from the FastAPI response.
  const getCourseId = (course) => course?.id ?? course?.course_id;

  // COMBINE LESSON COMPLETION ACROSS ALL COURSES.
  const courseProgressSummary = useMemo(() => {
    const rows = courses.map((course) => {
      const courseId = String(getCourseId(course));
      const lessons = getCourseLessons(course);
      const totalLessons = lessons.length || Number(course.lessons) || 0;
      const completed = completedLessons[courseId] || [];
      const completedCount = Math.min(completed.length, totalLessons || completed.length);
      const percentage = totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 100)
        : 0;

      return {
        id: courseId,
        name: course.name || course.title || "Course",
        totalLessons,
        completedCount,
        percentage
      };
    });

    const totalLessons = rows.reduce((sum, row) => sum + row.totalLessons, 0);
    const completedCount = rows.reduce((sum, row) => sum + row.completedCount, 0);

    return {
      rows,
      totalCourses: rows.length,
      completedCourses: rows.filter((row) => row.totalLessons > 0 && row.percentage === 100).length,
      totalLessons,
      completedLessons: completedCount,
      percentage: totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0,
      nextCourse: rows.filter((row) => row.percentage < 100).sort((a, b) => a.percentage - b.percentage)[0] || null
    };
  }, [courses, completedLessons]);

  // OPEN COURSE AND LOAD SAVED PROGRESS
  async function openCourse(course) {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setLessonError("");
    setError("");

    const user = auth.currentUser;

    if (!user) {
      setError("Please log in to view your course progress.");
      return;
    }

    const courseId = String(getCourseId(course));

    try {
      setProgressLoading(true);

      const progressRef = doc(
        db,
        "users",
        user.uid,
        "courseProgress",
        courseId
      );

      const progressSnapshot = await getDoc(progressRef);

      if (progressSnapshot.exists()) {
        const savedProgress = progressSnapshot.data();

        setCompletedLessons((current) => ({
          ...current,
          [courseId]: Array.isArray(savedProgress.completedLessons)
            ? savedProgress.completedLessons
            : []
        }));
      } else {
        setCompletedLessons((current) => ({
          ...current,
          [courseId]: []
        }));
      }
    } catch (err) {
      console.error("Course progress loading error:", err);
      setError("Could not load saved course progress. Please try again.");
    } finally {
      setProgressLoading(false);
    }
  }

  // OPEN LESSON AND FETCH CONTENT FROM FASTAPI
  async function openLesson(lesson, index) {
    if (!selectedCourse) return;

    try {
      setLessonLoading(true);
      setLessonError("");
      setSelectedLesson(null);
      setSelectedTopic(null);

      const courseId = getCourseId(selectedCourse);
      const lessonNumber = index + 1;

      const response = await fetch(
        `${API_URL}/courses/${courseId}/lessons/${lessonNumber}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to open lesson.");
      }

      setSelectedLesson({
        lesson,
        index,
        title: data.title || lesson,
        description: data.description || "",
        topics: Array.isArray(data.topics) ? data.topics : [],
        content: data.content || "No lesson content is available yet."
      });
    } catch (err) {
      console.error("Lesson loading error:", err);

      setLessonError(
        err.message || "Could not load lesson. Please try again."
      );
    } finally {
      setLessonLoading(false);
    }
  }

  // MARK LESSON AS COMPLETED AND SAVE TO FIRESTORE
  async function markLessonCompleted() {
    if (!selectedCourse || !selectedLesson) return;

    const user = auth.currentUser;

    if (!user) {
      setError("Please log in to save your lesson progress.");
      return;
    }

    const courseId = String(getCourseId(selectedCourse));
    const previous = completedLessons[courseId] || [];

    if (previous.includes(selectedLesson.index)) return;

    const updatedLessons = [...previous, selectedLesson.index];

    try {
      setProgressLoading(true);
      setError("");

      const progressRef = doc(
        db,
        "users",
        user.uid,
        "courseProgress",
        courseId
      );

      await setDoc(
        progressRef,
        {
          courseId,
          courseName:
            selectedCourse.name || selectedCourse.title || "Course",
          completedLessons: updatedLessons,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setCompletedLessons((current) => ({
        ...current,
        [courseId]: updatedLessons
      }));

      const totalLessons = getCourseLessons(selectedCourse).length;
      const allLessonsCompleted = totalLessons > 0 &&
        Array.from({ length: totalLessons }, (_, index) => index)
          .every((index) => updatedLessons.includes(index));

      // The backend validates completion and writes both private and public
      // certificate records using Firebase Admin credentials.
      if (allLessonsCompleted) {
        await issueCourseCertificate(
          courseId,
          selectedCourse.name || selectedCourse.title || "Course"
        );
      }
    } catch (err) {
      console.error("Lesson completion error:", err);
      setError("Could not save lesson progress. Please try again.");
    } finally {
      setProgressLoading(false);
    }
  }

  // SAVE QUIZ RESULT TO THE SIGNED-IN USER'S FIRESTORE ACCOUNT
  async function submitQuiz() {
    if (Object.keys(answers).length !== quiz.length) {
      setQuizSaveMessage("Please answer every question before submitting.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setQuizSubmitted(true);
      setQuizSaveMessage("Your score is shown, but please log in to save quiz history.");
      return;
    }

    const score = quiz.filter((item, index) => answers[index] === item.answer).length;
    const result = {
      title: quizTitle || `${quizTopic} Quiz`,
      topic: quizTopic,
      difficulty,
      score,
      totalQuestions: quiz.length,
      percentage: Math.round((score / quiz.length) * 100),
      answers: quiz.map((item, index) => ({
        question: item.question,
        options: item.options,
        correctAnswerIndex: item.answer,
        selectedAnswerIndex: answers[index],
        explanation: item.explanation || ""
      })),
      createdAt: serverTimestamp()
    };

    try {
      setQuizSaving(true);
      setQuizSaveMessage("");
      const resultsRef = collection(db, "users", currentUser.uid, "quizResults");
      const savedResult = await addDoc(resultsRef, result);
      setQuizSubmitted(true);
      setQuizHistory((current) => [{
        ...result,
        id: savedResult.id,
        createdAt: { toMillis: () => Date.now() }
      }, ...current]);
      setQuizSaveMessage("Quiz result saved successfully to Firebase!");
    } catch (err) {
      console.error("Quiz result saving error:", err);
      setQuizSubmitted(true);
      setQuizSaveMessage("Your score is shown, but the result could not be saved. Check your Firestore rules and try again.");
    } finally {
      setQuizSaving(false);
    }
  }


  // OPEN A SAVED QUIZ IN REVIEW MODE
  function openSavedQuiz(result) {
    if (!Array.isArray(result.answers) || result.answers.length === 0) {
      setQuizSaveMessage("This saved result does not contain quiz questions.");
      return;
    }

    const restoredQuestions = result.answers.map((item) => ({
      question: item.question || "Question unavailable",
      options: Array.isArray(item.options) ? item.options : [],
      answer: Number(item.correctAnswerIndex),
      explanation: item.explanation || ""
    }));

    if (restoredQuestions.some((item) =>
      item.options.length !== 4 || !Number.isInteger(item.answer) ||
      item.answer < 0 || item.answer > 3
    )) {
      setQuizSaveMessage("This saved quiz has an invalid question format.");
      return;
    }

    const restoredAnswers = {};
    result.answers.forEach((item, index) => {
      if (Number.isInteger(item.selectedAnswerIndex)) {
        restoredAnswers[index] = item.selectedAnswerIndex;
      }
    });

    setQuiz(restoredQuestions);
    setAnswers(restoredAnswers);
    setQuizTopic(result.topic || "Saved Quiz");
    setDifficulty(result.difficulty || "Beginner");
    setQuizTitle(result.title || `${result.topic || "Saved"} Quiz`);
    setQuizSubmitted(true);
    setQuizSaveMessage("Opened saved quiz in review mode.");
    goTo("quiz-generator");
  }

  // RETRY A SAVED QUIZ WITHOUT PREVIOUS ANSWERS
  function retrySavedQuiz(result) {
    if (!Array.isArray(result.answers) || result.answers.length === 0) {
      setQuizSaveMessage("This saved result does not contain quiz questions.");
      return;
    }

    const restoredQuestions = result.answers.map((item) => ({
      question: item.question || "Question unavailable",
      options: Array.isArray(item.options) ? item.options : [],
      answer: Number(item.correctAnswerIndex),
      explanation: item.explanation || ""
    }));

    if (restoredQuestions.some((item) =>
      item.options.length !== 4 || !Number.isInteger(item.answer) ||
      item.answer < 0 || item.answer > 3
    )) {
      setQuizSaveMessage("This saved quiz has an invalid question format.");
      return;
    }

    setQuiz(restoredQuestions);
    setAnswers({});
    setQuizTopic(result.topic || "Saved Quiz");
    setDifficulty(result.difficulty || "Beginner");
    setQuizTitle(result.title || `${result.topic || "Saved"} Quiz`);
    setQuizSubmitted(false);
    setQuizSaveMessage("Quiz ready to retry. Your new attempt will be saved separately.");
    goTo("quiz-generator");
  }

  // DELETE A SAVED QUIZ RESULT FROM FIRESTORE
  async function deleteSavedQuiz(resultId) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setQuizSaveMessage("Please sign in to delete a saved quiz.");
      return;
    }

    if (!window.confirm("Delete this saved quiz result? This cannot be undone.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "quizResults", resultId));
      setQuizHistory((current) => current.filter((item) => item.id !== resultId));
      setQuizSaveMessage("Saved quiz result deleted.");
    } catch (err) {
      console.error("Quiz result deletion error:", err);
      setQuizSaveMessage("Could not delete this quiz result. Check your Firestore rules and try again.");
    }
  }

  // GENERATE REAL AI QUIZ USING FASTAPI
  async function createQuiz() {
    const topic = quizTopic.trim();
    const notes = quizNotes.trim();
    const count = Number(questionCount);

    if (topic.length < 2) {
      setQuizError("Please enter a valid quiz topic.");
      return;
    }

    if (notes.length < 20) {
      setQuizError("Please enter at least 20 characters of study notes.");
      return;
    }

    if (count < 3 || count > 10) {
      setQuizError("Choose between 3 and 10 questions.");
      return;
    }

    try {
      setQuizLoading(true);
      setQuizError("");
      setQuiz([]);
      setQuizTitle("");
      setAnswers({});
      setQuizSubmitted(false);

      const response = await fetch(QUIZ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic,
          notes,
          question_count: count,
          difficulty
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Quiz generation failed. Please try again."
        );
      }

      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("The AI did not return any valid questions.");
      }

      const validQuestions = data.questions.filter((item) => {
        return (
          typeof item.question === "string" &&
          Array.isArray(item.options) &&
          item.options.length === 4 &&
          Number.isInteger(item.answer) &&
          item.answer >= 0 &&
          item.answer <= 3
        );
      });

      if (validQuestions.length === 0) {
        throw new Error("The AI returned questions in an invalid format.");
      }

      setQuiz(validQuestions);
      setQuizTitle(data.title || `${topic} Quiz`);

      goTo("quiz-generator");
    } catch (err) {
      console.error("AI quiz generation error:", err);

      setQuizError(
        err.message || "Could not generate the quiz. Please try again."
      );
    } finally {
      setQuizLoading(false);
    }
  }

  // CREATE SUMMARY
  function createSummary() {
    const cleaned = noteText.trim();

    if (!cleaned) {
      setSummary("Please enter your study notes first.");
      return;
    }

    const sentences =
      cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];

    const selected = sentences.slice(
      0,
      Math.max(1, Math.ceil(sentences.length / 3))
    );

    setSummary(
      selected.map((sentence) => sentence.trim()).join(" ")
    );
  }

  // ADD STUDY TASK TO FIRESTORE
  async function addTask(event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      setTaskError("Please log in to add tasks.");
      return;
    }

    if (!taskTitle.trim()) {
      setTaskError("Please enter a task name.");
      return;
    }

    try {
      setTaskSaving(true);
      setTaskMessage("");
      setTaskError("");

      const tasksRef = collection(db, "users", user.uid, "tasks");

      const newTask = {
        title: taskTitle.trim(),
        due: taskDue,
        course: taskCourse,
        priority: taskPriority,
        durationMinutes: Number(taskDuration),
        done: false,
        createdAt: serverTimestamp()
      };

      const document = await addDoc(tasksRef, newTask);

      setTasks((current) => [
        ...current,
        {
          id: document.id,
          title: newTask.title,
          due: newTask.due,
          course: newTask.course,
          priority: newTask.priority,
          durationMinutes: newTask.durationMinutes,
          done: false
        }
      ]);

      setTaskTitle("");
      setTaskDue("Today");
      setTaskCourse("Python Programming");
      setTaskPriority("Medium");
      setTaskDuration("30");
      setTaskMessage("Task saved successfully!");
    } catch (err) {
      console.error("Task saving error:", err);
      setTaskError("Could not save your task. Please try again.");
    } finally {
      setTaskSaving(false);
    }
  }

  // ADD OR UPDATE A WEEKLY STUDY SESSION
  async function saveTimetableSession(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      setTimetableError("Please log in to save your timetable.");
      return;
    }
    if (!sessionSubject.trim()) {
      setTimetableError("Please enter a subject or study topic.");
      return;
    }
    if (sessionStart >= sessionEnd) {
      setTimetableError("End time must be later than start time.");
      return;
    }
    try {
      setSessionSaving(true);
      setTimetableError("");
      setTimetableMessage("");
      const sessionData = {
        subject: sessionSubject.trim(),
        day: sessionDay,
        startTime: sessionStart,
        endTime: sessionEnd,
        updatedAt: serverTimestamp()
      };
      if (editingSessionId) {
        await updateDoc(doc(db, "users", user.uid, "timetable", editingSessionId), sessionData);
        setTimetableEntries((current) => current.map((item) => item.id === editingSessionId ? { ...item, ...sessionData } : item));
        setTimetableMessage("Study session updated successfully.");
      } else {
        const created = await addDoc(collection(db, "users", user.uid, "timetable"), { ...sessionData, createdAt: serverTimestamp() });
        setTimetableEntries((current) => [...current, { id: created.id, ...sessionData }].sort((a, b) => timetableDays.indexOf(a.day) - timetableDays.indexOf(b.day) || String(a.startTime).localeCompare(String(b.startTime))));
        setTimetableMessage("Study session added to your timetable.");
      }
      setSessionSubject("");
      setSessionDay(todayDayName);
      setSessionStart("09:00");
      setSessionEnd("10:00");
      setEditingSessionId(null);
    } catch (err) {
      console.error("Timetable save error:", err);
      setTimetableError("Could not save this session. Please try again.");
    } finally {
      setSessionSaving(false);
    }
  }

  function editTimetableSession(session) {
    setEditingSessionId(session.id);
    setSessionSubject(session.subject || "");
    setSessionDay(session.day || todayDayName);
    setSessionStart(session.startTime || "09:00");
    setSessionEnd(session.endTime || "10:00");
    setTimetableMessage("Editing session. Update the details and save.");
    setTimetableError("");
    document.getElementById("weekly-timetable")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteTimetableSession(sessionId) {
    const user = auth.currentUser;
    if (!user) {
      setTimetableError("Please log in again.");
      return;
    }
    try {
      await deleteDoc(doc(db, "users", user.uid, "timetable", sessionId));
      setTimetableEntries((current) => current.filter((item) => item.id !== sessionId));
      if (editingSessionId === sessionId) {
        setEditingSessionId(null);
        setSessionSubject("");
      }
      setTimetableMessage("Study session deleted.");
      setTimetableError("");
    } catch (err) {
      console.error("Timetable delete error:", err);
      setTimetableError("Could not delete this session. Please try again.");
    }
  }

  // SAVE DAILY AND WEEKLY LEARNING GOALS
  async function saveLearningGoals(event) {
    event.preventDefault();
    const user = auth.currentUser;
    const daily = Number(dailyGoalMinutes);
    const weekly = Number(weeklyGoalMinutes);
    if (!user) { setGoalError("Please log in to save your learning goals."); return; }
    if (!Number.isInteger(daily) || daily < 1 || daily > 1440 || !Number.isInteger(weekly) || weekly < 1 || weekly > 10080) {
      setGoalError("Enter a daily goal from 1–1440 minutes and a weekly goal from 1–10080 minutes."); return;
    }
    try {
      setGoalSaving(true); setGoalError("");
      await setDoc(doc(db, "users", user.uid, "learningGoals", "settings"), { dailyGoalMinutes: daily, weeklyGoalMinutes: weekly, updatedAt: serverTimestamp() }, { merge: true });
      setGoalMessage("Your learning goals have been saved.");
    } catch (err) {
      console.error("Learning goals save error:", err); setGoalError("Could not save your goals. Please try again.");
    } finally { setGoalSaving(false); }
  }

  // LOG STUDY TIME TO THE STUDENT'S DAILY ACTIVITY
  async function logStudyMinutes(event) {
    event.preventDefault();
    const user = auth.currentUser;
    const minutes = Number(studyMinutesInput);
    if (!user) { setGoalError("Please log in to record study activity."); return; }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) { setGoalError("Enter study time between 1 and 1440 minutes."); return; }
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    try {
      setActivitySaving(true); setGoalError("");
      const saved = await addDoc(collection(db, "users", user.uid, "studyActivity"), { date: dateKey, minutes, createdAt: serverTimestamp() });
      setStudyActivity((current) => [...current, { id: saved.id, date: dateKey, minutes }]);
      setGoalMessage(`${minutes} study minutes added to today's progress.`); setStudyMinutesInput("30");
    } catch (err) {
      console.error("Study activity save error:", err); setGoalError("Could not save study activity. Please try again.");
    } finally { setActivitySaving(false); }
  }

  // CREATE OR UPDATE A STUDY REMINDER
  async function saveReminder(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      setReminderError("Please log in to save reminders.");
      return;
    }
    if (!reminderTitle.trim() || !reminderDate || !reminderTime) {
      setReminderError("Please complete the reminder title, date and time.");
      return;
    }
    try {
      setReminderSaving(true);
      setReminderError("");
      setReminderMessage("");
      const reminderData = {
        title: reminderTitle.trim(),
        category: reminderCategory,
        date: reminderDate,
        time: reminderTime,
        completed: false,
        updatedAt: serverTimestamp()
      };
      if (editingReminderId) {
        const existing = reminders.find((item) => item.id === editingReminderId);
        const updatedData = { ...reminderData, completed: Boolean(existing?.completed) };
        await updateDoc(doc(db, "users", user.uid, "reminders", editingReminderId), updatedData);
        setReminders((current) => current.map((item) => item.id === editingReminderId ? { ...item, ...updatedData } : item));
        setReminderMessage("Reminder updated successfully.");
      } else {
        const created = await addDoc(collection(db, "users", user.uid, "reminders"), { ...reminderData, createdAt: serverTimestamp() });
        setReminders((current) => [...current, { id: created.id, ...reminderData }].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
        setReminderMessage("Your reminder has been saved.");
      }
      setReminderTitle("");
      setReminderCategory("Study Session");
      setReminderDate(new Date().toLocaleDateString("en-CA"));
      setReminderTime("18:00");
      setEditingReminderId(null);
    } catch (err) {
      console.error("Reminder save error:", err);
      setReminderError("Could not save this reminder. Please try again.");
    } finally {
      setReminderSaving(false);
    }
  }

  function editReminder(reminder) {
    setEditingReminderId(reminder.id);
    setReminderTitle(reminder.title || "");
    setReminderCategory(reminder.category || "Study Session");
    setReminderDate(reminder.date || new Date().toLocaleDateString("en-CA"));
    setReminderTime(reminder.time || "18:00");
    setReminderMessage("Editing reminder. Update the details and save.");
    setReminderError("");
    document.getElementById("study-reminders")?.scrollIntoView({ behavior: "smooth" });
  }

  async function toggleReminder(reminder) {
    const user = auth.currentUser;
    if (!user) {
      setReminderError("Please log in again.");
      return;
    }
    try {
      const completed = !reminder.completed;
      await updateDoc(doc(db, "users", user.uid, "reminders", reminder.id), { completed, updatedAt: serverTimestamp() });
      setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, completed } : item));
      setReminderMessage(completed ? "Reminder marked as completed." : "Reminder moved back to upcoming.");
      setReminderError("");
    } catch (err) {
      console.error("Reminder update error:", err);
      setReminderError("Could not update this reminder. Please try again.");
    }
  }

  async function deleteReminder(reminderId) {
    const user = auth.currentUser;
    if (!user) {
      setReminderError("Please log in again.");
      return;
    }
    try {
      await deleteDoc(doc(db, "users", user.uid, "reminders", reminderId));
      setReminders((current) => current.filter((item) => item.id !== reminderId));
      if (editingReminderId === reminderId) setEditingReminderId(null);
      setReminderMessage("Reminder deleted.");
      setReminderError("");
    } catch (err) {
      console.error("Reminder delete error:", err);
      setReminderError("Could not delete this reminder. Please try again.");
    }
  }

  // MARK TASK AS COMPLETED OR PENDING
  async function toggleTask(task) {
    const user = auth.currentUser;

    if (!user) {
      setTaskError("Please log in again.");
      return;
    }

    try {
      setTaskError("");
      setTaskMessage("");

      const taskRef = doc(db, "users", user.uid, "tasks", task.id);
      const updatedDone = !task.done;

      await updateDoc(taskRef, {
        done: updatedDone
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, done: updatedDone }
            : item
        )
      );
    } catch (err) {
      console.error("Task update error:", err);
      setTaskError("Could not update the task. Please try again.");
    }
  }

  // DELETE TASK FROM FIRESTORE
  async function removeTask(taskId) {
    const user = auth.currentUser;

    if (!user) {
      setTaskError("Please log in again.");
      return;
    }

    try {
      setTaskError("");
      setTaskMessage("");

      const taskRef = doc(db, "users", user.uid, "tasks", taskId);

      await deleteDoc(taskRef);

      setTasks((current) =>
        current.filter((item) => item.id !== taskId)
      );

      setTaskMessage("Task deleted successfully!");
    } catch (err) {
      console.error("Task deletion error:", err);
      setTaskError("Could not delete the task. Please try again.");
    }
  }

  // SAVE NEW FLASHCARD TO FIRESTORE
  async function addFlashcard(event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      setFlashcardError("Please log in again.");
      return;
    }

    if (!newCardFront.trim() || !newCardBack.trim()) {
      setFlashcardError("Please enter both a question and an answer.");
      return;
    }

    try {
      setFlashcardSaving(true);
      setFlashcardError("");
      setFlashcardMessage("");

      const cardsRef = collection(db, "users", user.uid, "flashcards");

      const newCard = {
        front: newCardFront.trim(),
        back: newCardBack.trim(),
        createdAt: serverTimestamp()
      };

      const document = await addDoc(cardsRef, newCard);

      const savedCard = {
        id: document.id,
        front: newCard.front,
        back: newCard.back
      };

      setFlashcards((current) => {
        const updatedCards = [...current, savedCard];
        setCardIndex(updatedCards.length - 1);
        return updatedCards;
      });

      setCardFlipped(false);
      setNewCardFront("");
      setNewCardBack("");
      setFlashcardMessage("Flashcard saved successfully!");
    } catch (err) {
      console.error("Flashcard saving error:", err);

      setFlashcardError(
        "Could not save flashcard. Please check your Firestore rules and try again."
      );
    } finally {
      setFlashcardSaving(false);
    }
  }

  // SAVE STUDENT PROFILE TO FIRESTORE
  async function saveProfile(event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      setProfileError("Please log in again to save your profile.");
      return;
    }

    if (!profile.name.trim() || !profile.goal.trim()) {
      setProfileError("Please enter your name and learning goal.");
      return;
    }

    try {
      setProfileSaving(true);
      setProfileMessage("");
      setProfileError("");

      const profileRef = doc(db, "users", user.uid);

      const updatedData = {
        name: profile.name.trim(),
        email: user.email || "",
        goal: profile.goal.trim(),
        updatedAt: serverTimestamp()
      };

      await setDoc(profileRef, updatedData, { merge: true });

      await updateAuthProfile(user, {
        displayName: profile.name.trim()
      });

      setProfile((current) => ({
        ...current,
        name: profile.name.trim(),
        email: user.email || ""
      }));

      setProfileMessage("Your profile has been saved successfully!");
    } catch (err) {
      console.error("Profile saving error:", err);

      setProfileError(
        "Could not save your profile. Please check your Firestore rules and try again."
      );
    } finally {
      setProfileSaving(false);
    }
  }

  // SAVE A STUDY MATERIAL TO FIRESTORE
  async function saveStudyMaterial(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { setMaterialError("Please log in to save study materials."); return; }
    if (!materialTitle.trim() || !materialContent.trim()) {
      setMaterialError("Enter a title and study notes before saving.");
      return;
    }
    try {
      setMaterialSaving(true);
      setMaterialError("");
      setMaterialMessage("");
      const materialsRef = collection(db, "users", user.uid, "studyMaterials");
      const saved = await addDoc(materialsRef, {
        title: materialTitle.trim(),
        course: materialCourse,
        content: materialContent.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setStudyMaterials((current) => [{
        id: saved.id, title: materialTitle.trim(), course: materialCourse,
        content: materialContent.trim(), createdAt: null
      }, ...current]);
      setMaterialTitle("");
      setMaterialContent("");
      setMaterialMessage("Study material saved to your Firebase account.");
    } catch (err) {
      console.error("Study material save error:", err);
      setMaterialError("Could not save this material. Check your Firestore rules and try again.");
    } finally { setMaterialSaving(false); }
  }

  async function deleteStudyMaterial(materialId) {
    const user = auth.currentUser;
    if (!user) { setMaterialError("Please log in to delete study materials."); return; }
    try {
      await deleteDoc(doc(db, "users", user.uid, "studyMaterials", materialId));
      setStudyMaterials((current) => current.filter((item) => item.id !== materialId));
      setMaterialMessage("Study material deleted.");
    } catch (err) {
      console.error("Study material delete error:", err);
      setMaterialError("Could not delete this material. Please try again.");
    }
  }

  function importMaterialFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = /\.(txt|md)$/i.test(file.name);
    if (!allowed) {
      setMaterialError("For now, upload a .txt or .md file. You can paste notes from PDFs into the editor.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMaterialContent(String(reader.result || ""));
      if (!materialTitle.trim()) setMaterialTitle(file.name.replace(/\.(txt|md)$/i, ""));
      setMaterialError("");
      setMaterialMessage(`Loaded ${file.name}. Click Save Material to store it in Firebase.`);
    };
    reader.onerror = () => setMaterialError("Could not read that file.");
    reader.readAsText(file);
    event.target.value = "";
  }

  // FEATURE 14 ACTIONS — upload to Firebase Storage, metadata to Firestore.
  const learningResourceCourses = ["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"];
  const learningResourceAllowedTypes = ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];

  useEffect(() => {
    let active = true;
    const loadResources = async () => {
      const user = auth.currentUser;
      if (!user) { if (active) { setLearningResources([]); setLearningResourcesLoading(false); } return; }
      try {
        setLearningResourcesLoading(true);
        setLearningResourceError("");
        // Firestore security rules are not client-side filters: constrain each
        // query to exactly the documents that the signed-in role may read.
        const resourcesQuery = accountRole === "admin"
          ? collection(db, "learningResources")
          : accountRole === "faculty"
            ? query(collection(db, "learningResources"), where("createdBy", "==", user.uid))
            : query(collection(db, "learningResources"), where("status", "==", "published"));
        const snapshot = await getDocs(resourcesQuery);
        const visible = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        visible.sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
        if (active) setLearningResources(visible);
      } catch (err) {
        console.error("Learning resources load error:", err);
        if (active) setLearningResourceError(`Could not load resources (${err.code || "unknown error"}). Check the signed-in user's users/{uid}.role and Firestore rules for learningResources.`);
      } finally { if (active) setLearningResourcesLoading(false); }
    };
    loadResources();
    return () => { active = false; };
  }, [accountRole]);

  async function saveLearningResource(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !["faculty", "admin"].includes(accountRole)) { setLearningResourceError("Only approved faculty or admin accounts can publish resources."); return; }
    if (!learningResourceTitle.trim()) { setLearningResourceError("Enter a resource title."); return; }
    if (learningResourceType === "file" && !learningResourceFile && !editingLearningResourceId) { setLearningResourceError("Choose a PDF, PPT, DOC or notes file to upload."); return; }
    if (learningResourceType === "video" && !/^https:\/\//i.test(learningResourceUrl.trim())) { setLearningResourceError("Enter a valid HTTPS video URL."); return; }
    if (learningResourceFile && (!learningResourceAllowedTypes.includes(learningResourceFile.type) || learningResourceFile.size > 25 * 1024 * 1024)) { setLearningResourceError("Use PDF, PPT, PPTX, DOC, DOCX, TXT or MD files up to 25 MB."); return; }
    try {
      setLearningResourceSaving(true); setLearningResourceError(""); setLearningResourceMessage("");
      const existing = editingLearningResourceId ? learningResources.find((item) => item.id === editingLearningResourceId) : null;
      const resourceRef = editingLearningResourceId
        ? doc(db, "learningResources", editingLearningResourceId)
        : doc(collection(db, "learningResources"));
      let fileData = existing?.file || null;
      if (learningResourceType === "file" && learningResourceFile) {
        const safeName = learningResourceFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `learning-resources/${resourceRef.id}/${user.uid}/${Date.now()}_${safeName}`;
        const uploaded = await uploadBytes(storageRef(getStorage(), path), learningResourceFile, { contentType: learningResourceFile.type || "application/octet-stream" });
        fileData = { name: learningResourceFile.name, path, contentType: learningResourceFile.type || "application/octet-stream", size: learningResourceFile.size };
      }
      const payload = {
        title: learningResourceTitle.trim(), course: learningResourceCourse,
        level: learningResourceLevel, subject: learningResourceSubject.trim(), description: learningResourceDescription.trim(),
        resourceType: learningResourceType, url: learningResourceType === "video" ? learningResourceUrl.trim() : "",
        file: learningResourceType === "file" ? fileData : null,
        status: learningResourceStatus, createdBy: existing?.createdBy || user.uid,
        createdByEmail: existing?.createdByEmail || user.email || "", updatedAt: serverTimestamp()
      };
      if (editingLearningResourceId) {
        await setDoc(resourceRef, payload, { merge: true });
        if (existing?.file?.path && existing.file.path !== payload.file?.path) {
          try { await deleteObject(storageRef(getStorage(), existing.file.path)); } catch (storageError) { console.warn("Previous resource file cleanup failed:", storageError); }
        }
        setLearningResources((items) => items.map((item) => item.id === editingLearningResourceId ? { ...item, ...payload } : item));
        setLearningResourceMessage("Learning resource updated.");
      } else {
        payload.createdAt = serverTimestamp();
        await setDoc(resourceRef, payload);
        setLearningResources((items) => [{ ...payload, id: resourceRef.id }, ...items]);
        setLearningResourceMessage(learningResourceStatus === "published" ? "Resource published to the student library." : "Resource saved as a draft.");
      }
      setEditingLearningResourceId(null); setLearningResourceTitle(""); setLearningResourceSubject("");
      setLearningResourceLevel("Beginner"); setLearningResourceDescription(""); setLearningResourceUrl(""); setLearningResourceFile(null);
      setLearningResourceType("file"); setLearningResourceStatus("published");
      const picker = document.getElementById("learning-resource-file"); if (picker) picker.value = "";
    } catch (err) {
      console.error("Learning resource save error:", err);
      setLearningResourceError(`Could not save this resource (${err.code || "unknown error"}). Check Storage upload permissions, Firestore create/update permissions, and your account role.`);
    } finally { setLearningResourceSaving(false); }
  }

  function editLearningResource(item) {
    setEditingLearningResourceId(item.id); setLearningResourceTitle(item.title || "");
    setLearningResourceCourse(item.course || learningResourceCourses[0]); setLearningResourceSubject(item.subject || "");
    setLearningResourceLevel(item.level || "Beginner"); setLearningResourceDescription(item.description || ""); setLearningResourceType(item.resourceType || (item.url ? "video" : "file"));
    setLearningResourceUrl(item.url || ""); setLearningResourceStatus(item.status || "draft");
    setLearningResourceFile(null); setLearningResourceError(""); setLearningResourceMessage("Editing selected resource.");
    document.getElementById("learning-resources")?.scrollIntoView({ behavior: "smooth" });
  }

  async function downloadLearningResource(item) {
    if (!item.file?.path) return;
    try {
      const blob = await getBlob(storageRef(getStorage(), item.file.path));
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = item.file.name || item.title || "learning-resource";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (err) {
      console.error("Resource download error:", err);
      setLearningResourceError(`Could not download this file (${err.code || "unknown error"}). Check Storage read permissions and sign-in status.`);
    }
  }

  async function deleteLearningResource(item) {
    const user = auth.currentUser;
    if (!user || !(accountRole === "admin" || (accountRole === "faculty" && item.createdBy === user.uid))) return;
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try {
      // Delete the Storage object while its Firestore metadata still exists;
      // Storage rules consult that metadata to verify the owner's permission.
      if (item.file?.path) { try { await deleteObject(storageRef(getStorage(), item.file.path)); } catch (storageError) { console.warn("Storage cleanup failed:", storageError); } }
      await deleteDoc(doc(db, "learningResources", item.id));
      setLearningResources((items) => items.filter((resource) => resource.id !== item.id));
      setLearningResourceMessage("Resource deleted.");
    } catch (err) { console.error(err); setLearningResourceError("Could not delete resource. Check Firebase permissions."); }
  }

  // FACULTY / ADMIN CONTENT MANAGEMENT
  async function saveFacultyResource(event) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !["faculty", "admin"].includes(accountRole)) {
      setFacultyError("This area is available only to approved faculty or admin accounts.");
      return;
    }
    if (!facultyTitle.trim() || !facultyContent.trim()) {
      setFacultyError("Enter a title and content before saving.");
      return;
    }
    const payload = {
      title: facultyTitle.trim(),
      course: facultyCourse,
      type: facultyType,
      description: facultyDescription.trim(),
      content: facultyContent.trim(),
      status: facultyStatus.toLowerCase(),
      createdBy: user.uid,
      createdByEmail: user.email || "",
      updatedAt: serverTimestamp()
    };
    try {
      setFacultySaving(true);
      setFacultyError("");
      setFacultyMessage("");
      if (facultyEditingId) {
        await updateDoc(doc(db, "courseContent", facultyEditingId), payload);
        setFacultyResources((items) => items.map((item) => item.id === facultyEditingId ? { ...item, ...payload } : item));
        setFacultyMessage("Course content updated successfully.");
      } else {
        payload.createdAt = serverTimestamp();
        const saved = await addDoc(collection(db, "courseContent"), payload);
        setFacultyResources((items) => [{ ...payload, id: saved.id }, ...items]);
        setFacultyMessage(facultyStatus === "Published" ? "Course content published." : "Draft saved successfully.");
      }
      setFacultyEditingId(null);
      setFacultyTitle("");
      setFacultyDescription("");
      setFacultyContent("");
      setFacultyType("Lesson");
      setFacultyStatus("Draft");
    } catch (err) {
      console.error("Faculty content save error:", err);
      setFacultyError("Could not save course content. Check the Firestore security rules described in the setup instructions.");
    } finally {
      setFacultySaving(false);
    }
  }

  function editFacultyResource(item) {
    setFacultyEditingId(item.id);
    setFacultyTitle(item.title || "");
    setFacultyCourse(item.course || "Python Programming");
    setFacultyType(item.type || "Lesson");
    setFacultyDescription(item.description || "");
    setFacultyContent(item.content || "");
    setFacultyStatus(item.status === "published" ? "Published" : "Draft");
    setFacultyMessage("Editing selected course content.");
    setFacultyError("");
    document.getElementById("faculty-panel")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteFacultyResource(resourceId) {
    if (!auth.currentUser || !["faculty", "admin"].includes(accountRole)) return;
    if (!window.confirm("Delete this course content? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "courseContent", resourceId));
      setFacultyResources((items) => items.filter((item) => item.id !== resourceId));
      setFacultyMessage("Course content deleted.");
    } catch (err) {
      console.error("Faculty content delete error:", err);
      setFacultyError("Could not delete this content. Check your Firestore rules.");
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAccountRole("student");
        setFacultyResources([]);
        return;
      }
      try {
        const profileSnapshot = await getDoc(doc(db, "users", user.uid));
        const role = String(profileSnapshot.data()?.role || "student").toLowerCase();
        setAccountRole(role);
        if (["faculty", "admin"].includes(role)) {
          setFacultyLoading(true);
          const snapshot = await getDocs(collection(db, "courseContent"));
          const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
          items.sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
          setFacultyResources(items);
        } else {
          setFacultyResources([]);
        }
      } catch (err) {
        console.error("Faculty panel loading error:", err);
        setFacultyError("Could not load faculty content. Check Firestore rules.");
      } finally {
        setFacultyLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ADMIN USER DIRECTORY: only admins can load the users collection.
  useEffect(() => {
    let cancelled = false;
    async function loadAdminUsers() {
      if (accountRole !== "admin" || !auth.currentUser) {
        setAdminUsers([]);
        return;
      }
      setAdminUsersLoading(true);
      setAdminUsersError("");
      try {
        const snapshot = await getDocs(collection(db, "users"));
        if (cancelled) return;
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        rows.sort((a, b) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id)));
        setAdminUsers(rows);
      } catch (err) {
        console.error("Admin user directory error:", err);
        if (!cancelled) setAdminUsersError("Could not load users. Confirm that the updated admin-only Firestore user-read rule has been published.");
      } finally {
        if (!cancelled) setAdminUsersLoading(false);
      }
    }
    loadAdminUsers();
    return () => { cancelled = true; };
  }, [accountRole]);

  async function updateManagedUserRole(targetUser, nextRole) {
    if (accountRole !== "admin" || !auth.currentUser) {
      setAdminUsersError("Only an authenticated admin can manage account roles.");
      return;
    }
    if (!targetUser?.id || !["student", "faculty"].includes(nextRole)) {
      setAdminUsersError("Admins can assign Student or Faculty. Admin privileges must be granted separately by a trusted project owner.");
      return;
    }
    if (targetUser.id === auth.currentUser.uid) {
      setAdminUsersError("You cannot change your own role from this screen.");
      return;
    }
    if (String(targetUser.role || "student").toLowerCase() === "admin") {
      setAdminUsersError("Admin accounts cannot be changed from the dashboard.");
      return;
    }
    setAdminRoleSavingId(targetUser.id);
    setAdminUsersError("");
    setAdminUsersMessage("");
    try {
      await updateDoc(doc(db, "users", targetUser.id), { role: nextRole });
      setAdminUsers((current) => current.map((item) => item.id === targetUser.id ? { ...item, role: nextRole } : item));
      setAdminUsersMessage(`Updated ${targetUser.name || targetUser.email || "user"} to ${nextRole}.`);
    } catch (err) {
      console.error("Role update error:", err);
      setAdminUsersError("Role update was denied. Check that your signed-in account has role=admin and that the admin role-update Firestore rule is published.");
    } finally {
      setAdminRoleSavingId("");
    }
  }

  // SIDEBAR NAVIGATION
  const navItems = [
    ["dashboard", "🏠", "Dashboard"],
    ["my-courses", "📚", "My Courses"],
    ["ai-tools", "✨", "AI Study Tools"],
    ["smart-tutor", "🤖", "WiZiAI Smart Tutor"],
    ["quiz-generator", "🧠", "Quiz Generator"],
    ["assessment-center", "📝", "Assessment Center"],
    ["career-center", "🚀", "Career & Placement"],
    ["summarizer", "📝", "Smart Summaries"],
    ["study-materials", "📂", "Study Materials"],
    ["learning-resources", "📚", "Learning Resources"],
    ["flashcards", "🗂️", "AI Flashcards"],
    ["progress-overview", "📈", "Progress Overview"],
    ["analytics", "📊", "Analytics"],
    ["certificates", "🏅", "My Certificates"],
    ["personalized-learning", "🎯", "Personalized Learning"],
    ["study-planner", "📅", "Study Planner"],
    ["weekly-timetable", "🗓️", "Weekly Timetable"],
    ["attendance", "📅", "Attendance"],
    ["course-feedback", "⭐", "Course Feedback"],
    ["announcements", "📣", `Announcements${publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length ? ` (${publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length})` : ""}`],
    ["study-reminders", "🔔", "Reminders & Notifications"],
    ["learning-goals", "🎯", "Learning Goals & Streaks"],
    ["assignments", "📋", "Assignments"],
    ["course-discussions", "💬", "Discussion Forum"],
    ["study-groups", "👥", "Study Groups"],
    ["peer-challenges", "🏆", "Peer Challenges"],
    ["practice-lab", "🧪", "Interactive Practice Lab"],
    ["digital-library", "📚", "Digital Library & Notes"],
    ["exam-simulator", "📝", "Smart Exam Simulator"],
    ["interview-prep-studio", "🎤", "AI Interview Preparation Studio"],
    ["educational-escape-room", "🗝️", "AI Educational Escape Room"],
    ["ai-debate-arena", "🏆", "AI Debate Arena"],
    ["concept-map-studio", "🧠", "Concept Map Studio"],
    ["accessibility-assistant", "♿", "Accessibility Assistant"],
    ["profile", "👤", "My Profile"],
    ["settings", "⚙️", "Settings"],
    ...(accountRole === "admin" ? [["admin-panel", "🛡️", "Admin Dashboard"]] : []),
    ...(["faculty", "admin"].includes(accountRole) ? [["faculty-panel", "🎓", "Faculty / Admin Panel"]] : [])
  ];

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <a
          href="#dashboard"
          className="dashboard-logo"
          onClick={(event) => {
            event.preventDefault();
            goTo("dashboard");
          }}
        >
          <span>S</span> SmartLearn <b>AI</b>
        </a>

        <p className="sidebar-label">MAIN MENU</p>

        <nav className="dashboard-navigation">
          {navItems.map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={`sidebar-link ${
                activeSection === id ? "active" : ""
              }`}
              onClick={() => goTo(id)}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <p>Keep learning every day!</p>
          <button type="button" onClick={onBack}>
            ← Back to Home
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar" id="dashboard">
          <div>
            <h2>Dashboard</h2>
            <p>Your personal SmartLearn AI learning workspace.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16, marginLeft: "auto" }}>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                aria-label={`Notifications${publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length ? `, ${publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length} unread` : ""}`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
                style={{ position: "relative", border: "1px solid #dbe4ee", background: "#fff", color: "#18334f", borderRadius: 12, width: 44, height: 44, cursor: "pointer", fontSize: 21, display: "grid", placeItems: "center" }}
              >
                🔔
                {publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 19, height: 19, padding: "0 4px", borderRadius: 20, background: "#dc3545", color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", border: "2px solid #fff" }}>{publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length}</span>}
              </button>
              {notificationOpen && <div role="dialog" aria-label="Notifications" style={{ position: "absolute", top: "calc(100% + 12px)", right: 0, width: "min(360px, calc(100vw - 32px))", maxHeight: 430, overflowY: "auto", zIndex: 1000, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, boxShadow: "0 14px 38px rgba(15, 35, 60, .18)", padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid #edf1f5" }}>
                  <strong style={{ color: "#18334f" }}>Notifications</strong>
                  <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Close notifications" style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 20, color: "#64748b" }}>×</button>
                </div>
                {(() => {
                  const notices = publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement").slice(0, 8);
                  if (!notices.length) return <p className="demo-note" style={{ margin: "18px 4px" }}>You are all caught up. No announcements yet.</p>;
                  return <div style={{ display: "grid", gap: 8, paddingTop: 10 }}>{notices.map((item) => {
                    const isRead = Boolean(announcementReads[item.id]);
                    const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : "Recently";
                    return <div key={item.id} style={{ padding: 10, borderRadius: 10, background: isRead ? "#f8fafc" : "#effaf8", borderLeft: `3px solid ${isRead ? "#cbd5e1" : "#13a69b"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><strong style={{ color: "#18334f", fontSize: 13 }}>{item.title || "Course announcement"}</strong>{!isRead && <span style={{ color: "#087f75", fontSize: 10, fontWeight: 800 }}>NEW</span>}</div>
                      <p style={{ margin: "5px 0", color: "#526174", fontSize: 12, lineHeight: 1.45 }}>{item.description || item.content || "A new course announcement is available."}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><small style={{ color: "#8290a0" }}>{item.course || "All courses"} · {date}</small>{!isRead && <button type="button" onClick={() => markAnnouncementRead(item)} style={{ border: 0, background: "transparent", color: "#087f75", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Mark read</button>}</div>
                    </div>;
                  })}</div>;
                })()}
                <button type="button" onClick={() => { setNotificationOpen(false); goTo("announcements"); }} style={{ width: "100%", marginTop: 12, padding: "10px 12px", border: 0, borderRadius: 9, background: "#18334f", color: "#fff", fontWeight: 700, cursor: "pointer" }}>View all announcements</button>
              </div>}
            </div>
            <div className="student-profile">
              <span>👨‍🎓</span>
              <div>
                <b>{profile.name || "Student"}</b>
                <small>{accountRole ? `${accountRole.charAt(0).toUpperCase()}${accountRole.slice(1)} Account` : "Student Account"}</small>
              </div>
            </div>
          </div>
        </header>

        {/* WELCOME */}
        <section className="dashboard-welcome">
          <div>
            <span>YOUR LEARNING JOURNEY</span>
            <h1>Welcome Back, {profile.name || "Student"}! 👋</h1>
            <p>
              Keep learning, keep improving, and achieve your goals with SmartLearn AI.
            </p>
            <button type="button" onClick={() => goTo("my-courses")}>
              Continue Learning →
            </button>
          </div>

          <div className="welcome-icon">🎓</div>
        </section>

        {/* DASHBOARD STATS */}
        <section className="dashboard-stats">
          {[
            ["📚", "Available Courses", String(courses.length).padStart(2, "0")],
            ["✅", "Completed Tasks", String(completedTasks).padStart(2, "0")],
            ["📝", "Quizzes Created", String(quiz.length ? 1 : 0).padStart(2, "0")],
            ["⭐", "Flashcards", String(flashcards.length).padStart(2, "0")]
          ].map(([icon, label, value]) => (
            <div className="dashboard-stat-card" key={label}>
              <span>{icon}</span>
              <p>{label}</p>
              <h2>{value}</h2>
            </div>
          ))}
        </section>

        {/* MY COURSES */}
        <section className="dashboard-section" id="my-courses">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR LEARNING</span>
              <h2>My Courses</h2>
              <p className="section-description">
                Courses loaded from your Python FastAPI backend.
              </p>
            </div>
          </div>

          <div className="workspace-card" style={{ padding: 18, marginBottom: 18 }}>
            <h3 style={{ marginTop: 0, color: "#18334f" }}>Choose learning level</h3>
            <p className="section-description" style={{ marginBottom: 12 }}>Select any level to view faculty notes and learning materials shared for that level.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                ["all", "All Levels"],
                ["Beginner", "Beginner"],
                ["Intermediate", "Intermediate"],
                ["Advanced", "Advanced"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={courseNotesLevelFilter === value ? "primary-action" : "secondary-action"}
                  aria-pressed={courseNotesLevelFilter === value}
                  onClick={() => setCourseNotesLevelFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <p className="demo-note">Loading courses from backend...</p>
          )}

          {error && (
            <div className="demo-result">
              <p>{error}</p>
              <button
                type="button"
                className="primary-action"
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && courses.length === 0 && (
            <p className="demo-note">
              No courses are available yet. Add course management to the backend next.
            </p>
          )}

          {!loading && !error && (
            <div className="dashboard-course-grid">
              {courses.map((course) => (
                <article className="dashboard-course-card" key={getCourseId(course)}>
                  <div className="dashboard-course-icon">📘</div>

                  <div className="course-card-meta">
                    <span>{course.level || "Course"}</span>
                    <span>
                      {getCourseLessons(course).length ||
                        course.lessons ||
                        0} Lessons
                    </span>
                  </div>

                  <h3>{course.name || course.title}</h3>

                  <p>
                    {course.description ||
                      "Explore lessons and improve your knowledge."}
                  </p>

                  <button
                    type="button"
                    onClick={() => openCourse(course)}
                  >
                    Explore Course →
                  </button>
                </article>
              ))}
            </div>
          )}

          {/* PUBLISHED FACULTY NOTES — filtered by the selected learning level */}
          <div style={{ marginTop: 28 }}>
            <div className="dashboard-section-heading">
              <div>
                <span>FACULTY-SHARED MATERIALS</span>
                <h2>Course Notes & Learning Materials</h2>
                <p className="section-description">Published notes from faculty across all courses. Choose All Levels, Beginner, Intermediate or Advanced above.</p>
              </div>
              <span className="settings-status">{learningResources.filter((item) => item.status === "published" && (courseNotesLevelFilter === "all" || (item.level || "Beginner") === courseNotesLevelFilter)).length} materials</span>
            </div>

            {learningResourcesLoading && <p className="demo-note">Loading published faculty notes...</p>}
            {!learningResourcesLoading && learningResourceError && <p className="auth-error" role="alert">{learningResourceError}</p>}
            {!learningResourcesLoading && learningResources.filter((item) => item.status === "published" && (courseNotesLevelFilter === "all" || (item.level || "Beginner") === courseNotesLevelFilter)).length === 0 && (
              <div className="workspace-card" style={{ padding: 18 }}>
                <h3>No published notes for this level yet</h3>
                <p className="demo-note">Faculty notes will appear here after they publish them. Try another level or select All Levels.</p>
              </div>
            )}
            <div className="dashboard-course-grid">
              {learningResources.filter((item) => item.status === "published" && (courseNotesLevelFilter === "all" || (item.level || "Beginner") === courseNotesLevelFilter)).map((item) => (
                <article className="dashboard-course-card" key={`course-note-${item.id}`}>
                  <div className="course-card-meta">
                    <span>{item.level || "Beginner"}</span>
                    <span>{item.course || "Course material"}</span>
                  </div>
                  <h3>{item.resourceType === "video" ? "▶️ " : "📄 "}{item.title}</h3>
                  {item.subject && <p><strong>Topic:</strong> {item.subject}</p>}
                  <p>{item.description || "Learning material shared by your faculty."}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {item.resourceType === "video" && item.url ? (
                      <a className="primary-action" href={item.url} target="_blank" rel="noreferrer">Open video</a>
                    ) : item.file?.path ? (
                      <button type="button" className="primary-action" onClick={() => downloadLearningResource(item)}>Download Notes</button>
                    ) : <span className="demo-note">No downloadable file attached.</span>}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* COURSE DETAILS AND LESSONS */}
          {selectedCourse && (
            <div id="course-details-panel" className="workspace-card course-details-panel">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setSelectedCourse(null);
                  setSelectedLesson(null);
                  setLessonError("");
                }}
              >
                ← Back to Courses
              </button>

              <div className="course-details-content">
                <span className="course-details-icon">📘</span>

                <p className="course-card-meta">
                  {selectedCourse.level || "Course"}
                </p>

                <h2>
                  {selectedCourse.name || selectedCourse.title}
                </h2>

                <p>
                  {selectedCourse.description ||
                    "Explore this course and improve your knowledge step by step."}
                </p>

                <div className="course-details-info">
                  <div>
                    <strong>Course Level</strong>
                    <p>{selectedCourse.level || "Not specified"}</p>
                  </div>

                  <div>
                    <strong>Total Lessons</strong>
                    <p>{getCourseLessons(selectedCourse).length}</p>
                  </div>
                </div>

                {/* LESSON PROGRESS */}
                <div className="lesson-progress">
                  <h3>Course Progress</h3>

                  {progressLoading ? (
                    <p>Loading saved progress...</p>
                  ) : (
                    <>
                      <p>
                        {(completedLessons[String(getCourseId(selectedCourse))] || []).length} of{" "}
                        {getCourseLessons(selectedCourse).length} lessons completed
                      </p>

                      <div className="lesson-progress-bar">
                        <span
                          style={{
                            width: `${
                              getCourseLessons(selectedCourse).length
                                ? (
                                    (completedLessons[String(getCourseId(selectedCourse))] || []).length /
                                    getCourseLessons(selectedCourse).length
                                  ) * 100
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* COURSE COMPLETION CERTIFICATE */}
                {(() => {
                  const courseId = String(getCourseId(selectedCourse));
                  const lessons = getCourseLessons(selectedCourse);
                  const completed = completedLessons[courseId] || [];
                  const certificate = certificates.find((item) => item.id === courseId);
                  const fullyCompleted = lessons.length > 0 && lessons.every((_, index) => completed.includes(index));
                  if (!fullyCompleted) return null;
                  return (
                    <div className="demo-note" style={{ margin: "18px 0", padding: 18, borderRadius: 12 }}>
                      <h3>🏅 Course completed!</h3>
                      <p>You've completed all {lessons.length} lessons. You can now request your verified certificate.</p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="primary-action"
                          onClick={async () => {
                            const issued = await issueCourseCertificate(
                              courseId,
                              selectedCourse.name || selectedCourse.title || "Course"
                            );
                            if (issued) await downloadCertificate(issued);
                          }}
                          disabled={certificateIssuing || progressLoading}
                        >
                          {certificateIssuing ? "Preparing Certificate..." : certificate ? "Refresh & Download Certificate" : "Issue Certificate with QR Code"}
                        </button>
                        {certificate && (
                          <button type="button" className="secondary-action" onClick={() => downloadCertificate(certificate)}>
                            Download Existing Certificate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* CONTINUE FROM THE FIRST UNFINISHED LESSON */}
                {getCourseLessons(selectedCourse).length > 0 && (() => {
                  const lessons = getCourseLessons(selectedCourse);
                  const completed = completedLessons[String(getCourseId(selectedCourse))] || [];
                  const nextIndex = lessons.findIndex((_, index) => !completed.includes(index));

                  if (nextIndex === -1) {
                    return (
                      <p className="demo-note" role="status">
                        🎉 You have completed every lesson in this course.
                      </p>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className="primary-action"
                      disabled={progressLoading || lessonLoading}
                      onClick={() => {
                        const nextLesson = lessons[nextIndex];
                        const nextTitle = typeof nextLesson === "string"
                          ? nextLesson
                          : nextLesson.title || `Lesson ${nextIndex + 1}`;
                        openLesson(nextTitle, nextIndex);
                      }}
                      style={{ marginTop: 14, marginBottom: 18 }}
                    >
                      Continue Learning — Lesson {nextIndex + 1} →
                    </button>
                  );
                })()}

                {/* LESSON LIST */}
                <h3>Course Lessons</h3>

                <div className="course-lesson-list">
                  {getCourseLessons(selectedCourse).map((lesson, index) => {
                    const lessonTitle =
                      typeof lesson === "string"
                        ? lesson
                        : lesson.title || `Lesson ${index + 1}`;

                    const isCompleted = (
                      completedLessons[String(getCourseId(selectedCourse))] || []
                    ).includes(index);

                    return (
                      <div className="course-lesson-item" key={index}>
                        <div className="lesson-number">
                          {isCompleted ? "✓" : index + 1}
                        </div>

                        <div className="lesson-information">
                          <h4>{lessonTitle}</h4>
                          <p>
                            {isCompleted ? "Completed" : "Ready to learn"}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="secondary-action"
                          disabled={lessonLoading}
                          onClick={() => openLesson(lessonTitle, index)}
                        >
                          Open Lesson →
                        </button>
                      </div>
                    );
                  })}
                </div>

                {getCourseLessons(selectedCourse).length === 0 && (
                  <p className="demo-note">
                    No lessons are available for this course yet. Add a lesson_list array to your Python backend.
                  </p>
                )}

                {/* LESSON LOADING */}
                {lessonLoading && (
                  <div className="selected-lesson-panel">
                    <p>Loading lesson content from SmartLearn AI...</p>
                  </div>
                )}

                {/* LESSON ERROR */}
                {lessonError && (
                  <div className="demo-result">
                    <p>{lessonError}</p>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setLessonError("")}
                    >
                      Close
                    </button>
                  </div>
                )}

                {/* SELECTED LESSON */}
                {selectedLesson && (
                  <div id="selected-lesson-panel" className="selected-lesson-panel">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setSelectedLesson(null);
                        setSelectedTopic(null);
                        setLessonError("");
                      }}
                    >
                      ← Back to Lessons
                    </button>

                    <p className="course-card-meta">
                      LESSON {selectedLesson.index + 1}
                    </p>

                    <h2>{selectedLesson.title}</h2>

                    {selectedLesson.description && (
                      <p>{selectedLesson.description}</p>
                    )}

                    {/* TOPICS RETURNED BY THE PYTHON BACKEND */}
                    <div className="lesson-topics">
                      <h3>Topics covered in this lesson</h3>
                      {selectedLesson.topics.length > 0 ? (
                        <div className="topic-button-list">
                          {selectedLesson.topics.map((topic, topicIndex) => (
                            <button
                              key={`${topic}-${topicIndex}`}
                              type="button"
                              className={`secondary-action ${selectedTopic?.index === topicIndex ? "active" : ""}`}
                              onClick={() => setSelectedTopic({ title: topic, index: topicIndex })}
                            >
                              {topic}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="demo-note">No topics are available for this lesson yet.</p>
                      )}
                    </div>

                    {selectedTopic && (
                      <div id="topic-learning-content" className="topic-learning-content">
                        {(() => {
                          const title = selectedTopic.title.toLowerCase();
                          const isWhatPython = title.includes("what is python");
                          const isHistory = title.includes("history") || title.includes("features");
                          const isUses = title.includes("uses");
                          const isAdvantages = title.includes("advantages");

                          const details = isWhatPython
                            ? {
                                heading: "What is Python?",
                                intro: "Python is a high-level, general-purpose programming language. Its readable syntax makes it a popular choice for beginners and experienced developers.",
                                points: ["Python code is written in readable statements.", "Python is dynamically typed, so you do not need to declare a variable's type first.", "Python supports procedural, object-oriented and functional programming styles."],
                                exampleTitle: "Display a message",
                                code: 'print("Hello, World!")',
                                output: "Hello, World!",
                                applications: ["Learning programming fundamentals", "Building web applications", "Automating repetitive tasks"]
                              }
                            : isHistory
                              ? {
                                  heading: "History and features of Python",
                                  intro: "Python was created by Guido van Rossum and first released in 1991. It was designed to make code readable and productive to write.",
                                  points: ["Python emphasizes clear, readable syntax.", "It is an interpreted, high-level language.", "It includes a large standard library and supports modules and packages."],
                                  exampleTitle: "A readable Python statement",
                                  code: 'message = "Welcome to Python"\nprint(message)',
                                  output: "Welcome to Python",
                                  applications: ["Rapid application development", "Scripting and automation", "Education and scientific computing"]
                                }
                              : isUses
                                ? {
                                    heading: "Uses of Python",
                                    intro: "Python is used in many areas because it has a broad ecosystem of libraries and tools.",
                                    points: ["Web development with frameworks such as Django and Flask.", "Data analysis and visualization with specialist libraries.", "Automation, testing, scientific computing and machine learning."],
                                    exampleTitle: "A small automation-style task",
                                    code: 'tasks = ["read", "practise", "revise"]\nfor task in tasks:\n    print(task)',
                                    output: "read\npractise\nrevise",
                                    applications: ["Web services", "Data analysis", "Testing and automation"]
                                  }
                                : isAdvantages
                                  ? {
                                      heading: "Advantages of Python",
                                      intro: "Python offers readable syntax, a large ecosystem and support across many platforms. The best language still depends on the needs of a particular project.",
                                      points: ["Readable code can make learning and maintenance easier.", "Many libraries help developers avoid writing everything from scratch.", "Python runs on common operating systems and has a large learning community."],
                                      exampleTitle: "Short code example",
                                      code: 'a = 10\nb = 20\nprint(a + b)',
                                      output: "30",
                                      applications: ["Prototypes and scripts", "Data-focused projects", "Backend services and educational projects"]
                                    }
                                  : {
                                      heading: selectedTopic.title,
                                      intro: `${selectedTopic.title} is covered in ${selectedLesson.title}. Use the key points and example below as a starting point, then compare them with your course notes.`,
                                      points: ["Identify the definition and purpose of the topic.", "List its main concepts and terminology.", "Explain how it connects to the rest of the lesson."],
                                      exampleTitle: "Your practice task",
                                      code: `# Write a short example about: ${selectedTopic.title}`,
                                      output: "Write and check your own example.",
                                      applications: ["Class notes and revision", "Practice questions", "A small example from your course"]
                                    };

                          return (
                            <>
                              <section className="topic-section">
                                <h3>1. {details.heading}</h3>
                                <p>{details.intro}</p>
                                <h4>What you should understand</h4>
                                <ul>{details.points.map((point, index) => <li key={index}>{point}</li>)}</ul>
                              </section>

                              <section className="topic-section">
                                <h3>2. Detailed Explanation</h3>
                                <p>{details.intro}</p>
                                <p>Read each point carefully, identify unfamiliar terms, and explain the idea in your own words. Use the example as a guide rather than memorising it.</p>
                              </section>

                              <section className="topic-section">
                                <h3>3. Key Points to Remember</h3>
                                <ul>{details.points.map((point, index) => <li key={index}>{point}</li>)}</ul>
                              </section>

                              <section className="topic-section">
                                <h3>4. Practical Example</h3>
                                <h4>{details.exampleTitle}</h4>
                                <pre><code>{details.code}</code></pre>
                                <strong>Output:</strong>
                                <pre><code>{details.output}</code></pre>
                              </section>

                              <section className="topic-section">
                                <h3>5. Applications</h3>
                                <ul>{details.applications.map((item, index) => <li key={index}>{item}</li>)}</ul>
                              </section>

                              <section className="topic-section">
                                <h3>6. Quick Revision</h3>
                                <ul>
                                  <li>Can you define {selectedTopic.title}?</li>
                                  <li>Can you explain its main points without looking?</li>
                                  <li>Can you write or describe one example?</li>
                                </ul>
                                <div className="topic-study-note">
                                  <strong>Study Tip</strong>
                                  <p>After reading, close your notes and explain the topic in three or four sentences. Then check your explanation against your course material.</p>
                                </div>
                              </section>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <div className="lesson-content">
                      {(selectedLesson.content || "")
                        .split("\n")
                        .map((paragraph, index) => (
                          <p key={index}>
                            {paragraph}
                          </p>
                        ))}
                    </div>

                    <button
                      type="button"
                      className="primary-action"
                      onClick={markLessonCompleted}
                      disabled={
                        progressLoading ||
                        (
                          completedLessons[String(getCourseId(selectedCourse))] || []
                        ).includes(selectedLesson.index)
                      }
                    >
                      {progressLoading
                        ? "Saving Progress..."
                        : (
                            completedLessons[String(getCourseId(selectedCourse))] || []
                          ).includes(selectedLesson.index)
                          ? "✓ Lesson Completed"
                          : "Mark as Completed"}
                    </button>
                  </div>
                )}

                <CoursePracticeWorkspace course={selectedCourse} />
              </div>
            </div>
          )}
        </section>

        {/* AI STUDY TOOLS */}
        <section className="dashboard-section" id="ai-tools">
          <div className="dashboard-section-heading">
            <div>
              <span>SMART LEARNING</span>
              <h2>Your AI Study Tools</h2>
            </div>
          </div>

          <div className="ai-tools-grid">
            <article className="ai-tool-card">
              <span>🧠</span>
              <h3>AI Quiz Generator</h3>
              <p>Create practice questions and check your answers.</p>
              <button type="button" onClick={() => goTo("quiz-generator")}>
                Open Quiz Generator →
              </button>
            </article>

            <article className="ai-tool-card">
              <span>📝</span>
              <h3>Smart Summaries</h3>
              <p>Turn your study notes into shorter revision points.</p>
              <button type="button" onClick={() => goTo("summarizer")}>
                Summarize Notes →
              </button>
            </article>

            <article className="ai-tool-card">
              <span>🗂️</span>
              <h3>AI Flashcards</h3>
              <p>Create and review question-and-answer cards.</p>
              <button type="button" onClick={() => goTo("flashcards")}>
                Open Flashcards →
              </button>
            </article>
          </div>
        </section>

        {/* REAL AI QUIZ GENERATOR */}
        <WiZiAISmartTutor />

        <section className="dashboard-section" id="quiz-generator">
          <div className="dashboard-section-heading">
            <div>
              <span>POWERED BY PYTHON FASTAPI</span>
              <h2>AI Quiz Generator</h2>
              <p className="section-description">
                Generate multiple-choice questions directly from your study notes.
              </p>
            </div>
          </div>

          <div className="workspace-card">
            <div className="form-grid">
              <label>
                Quiz topic
                <input
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  placeholder="Enter a topic"
                />
              </label>

              <label>
                Number of questions
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                >
                  <option value="3">3 questions</option>
                  <option value="5">5 questions</option>
                  <option value="10">10 questions</option>
                </select>
              </label>

              <label>
                Difficulty level
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </label>
            </div>

            <label className="full-label">
              Paste your study notes
              <textarea
                rows="7"
                value={quizNotes}
                onChange={(e) => setQuizNotes(e.target.value)}
                placeholder="Paste at least 20 characters of lecture notes or study material here..."
              />
            </label>

            <button
              type="button"
              className="primary-action"
              onClick={createQuiz}
              disabled={quizLoading}
            >
              {quizLoading ? "Generating AI Quiz..." : "✨ Generate AI Quiz"}
            </button>

            {quizLoading && (
              <p className="demo-note">
                SmartLearn AI is preparing your questions. Please wait...
              </p>
            )}

            {quizError && (
              <div className="demo-result">
                <p>{quizError}</p>
              </div>
            )}

            {quiz.length > 0 && (
              <div className="quiz-area">
                <h3>{quizTitle}</h3>

                <p className="demo-note">
                  {quizTopic} · {difficulty} · {quiz.length} questions
                </p>

                {quiz.map((item, index) => (
                  <div
                    className="quiz-question"
                    key={`${item.question}-${index}`}
                  >
                    <h3>
                      {index + 1}. {item.question}
                    </h3>

                    {item.options.map((option, optionIndex) => (
                      <label className="quiz-option" key={optionIndex}>
                        <input
                          type="radio"
                          name={`question-${index}`}
                          checked={answers[index] === optionIndex}
                          disabled={quizSubmitted}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [index]: optionIndex
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}

                    {quizSubmitted && (
                      <p
                        className={`quiz-explanation ${
                          answers[index] === item.answer
                            ? "correct"
                            : "incorrect"
                        }`}
                      >
                        {answers[index] === item.answer
                          ? "Correct! "
                          : "Not quite. "}
                        {item.explanation}
                      </p>
                    )}
                  </div>
                ))}

                {!quizSubmitted ? (
                  <button
                    type="button"
                    className="primary-action"
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length !== quiz.length || quizSaving}
                  >
                    {quizSaving ? "Saving Result..." : "Submit Quiz"}
                  </button>
                ) : (
                  <div className="quiz-score">
                    <b>
                      Your score: {quizScore} / {quiz.length}
                    </b>

                    <button
                      type="button"
                      className="secondary-action"
                      onClick={createQuiz}
                      disabled={quizLoading}
                    >
                      Generate Another Quiz
                    </button>
                  </div>
                )}
              </div>
            )}

            {quizSaveMessage && (
              <p className="demo-note" role="status">{quizSaveMessage}</p>
            )}

            <div className="workspace-card" style={{ marginTop: "24px" }}>
              <h3>My Quiz History</h3>
              {quizHistoryLoading ? (
                <p className="demo-note">Loading your saved quiz results...</p>
              ) : quizHistory.length === 0 ? (
                <p className="demo-note">No saved quiz results yet. Complete a quiz to see your history here.</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {quizHistory.slice(0, 10).map((result) => (
                    <div key={result.id} style={{ padding: "14px", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
                      <strong>{result.title || `${result.topic || "Quiz"} Quiz`}</strong>
                      <p className="demo-note" style={{ margin: "6px 0 10px" }}>
                        {result.topic} · {result.difficulty} · Score: {result.score}/{result.totalQuestions} ({result.percentage}%)
                      </p>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button type="button" className="secondary-action" onClick={() => openSavedQuiz(result)}>
                          Open Quiz
                        </button>
                        <button type="button" className="secondary-action" onClick={() => retrySavedQuiz(result)}>
                          Retry Quiz
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          style={{ color: "#b42318" }}
                          onClick={() => { deleteSavedQuiz(result.id); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <AssessmentCenter accountRole={accountRole} />
        <CareerPlacementCenter accountRole={accountRole} />

        {/* SMART SUMMARIES */}
        <section className="dashboard-section" id="summarizer">
          <div className="dashboard-section-heading">
            <div>
              <span>QUICK REVISION</span>
              <h2>Smart Notes Summarizer</h2>
            </div>
          </div>

          <div className="workspace-card">
            <label className="full-label">
              Paste your study notes
              <textarea
                rows="6"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Paste lecture notes or study material here..."
              />
            </label>

            <button
              type="button"
              className="primary-action"
              onClick={createSummary}
            >
              Create Summary
            </button>

            <p className="demo-note">
              This first version extracts selected sentences locally.
              AI-powered summarization and file uploads can be connected later.
            </p>

            {summary && (
              <div className="demo-result">
                <h3>Summary</h3>
                <p>{summary}</p>
              </div>
            )}
          </div>
        </section>

        {/* FLASHCARDS */}
        <section className="dashboard-section" id="flashcards">
          <div className="dashboard-section-heading">
            <div>
              <span>REMEMBER MORE</span>
              <h2>AI Flashcards</h2>
              <p className="section-description">
                Create your own cards and tap the card to reveal its answer.
                Your cards are saved in Firebase.
              </p>
            </div>
          </div>

          <div className="flashcard-workspace">
            {flashcardsLoading && (
              <p className="demo-note">Loading your saved flashcards...</p>
            )}

            {flashcardError && (
              <p className="auth-error">{flashcardError}</p>
            )}

            {flashcardMessage && (
              <p className="success-message">{flashcardMessage}</p>
            )}

            {!flashcardsLoading && flashcards.length > 0 && (
              <div className="flashcard-panel">
                <span className="flashcard-count">
                  Card {cardIndex + 1} of {flashcards.length}
                </span>

                <button
                  type="button"
                  className="flashcard"
                  onClick={() => setCardFlipped((value) => !value)}
                >
                  <small>
                    {cardFlipped ? "ANSWER" : "QUESTION"} · CLICK TO FLIP
                  </small>

                  <strong>
                    {cardFlipped
                      ? flashcards[cardIndex]?.back
                      : flashcards[cardIndex]?.front}
                  </strong>
                </button>

                <div className="flashcard-controls">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setCardIndex(
                        (current) =>
                          (current - 1 + flashcards.length) % flashcards.length
                      );
                      setCardFlipped(false);
                    }}
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setCardIndex(
                        (current) => (current + 1) % flashcards.length
                      );
                      setCardFlipped(false);
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {!flashcardsLoading && flashcards.length === 0 && !flashcardError && (
              <p className="demo-note">
                No flashcards found. Create your first flashcard below.
              </p>
            )}

            <form
              className="workspace-card add-card-form"
              onSubmit={addFlashcard}
            >
              <h3>Create a Flashcard</h3>

              <label>
                Question
                <input
                  value={newCardFront}
                  onChange={(e) => setNewCardFront(e.target.value)}
                  placeholder="Enter a question"
                  required
                />
              </label>

              <label>
                Answer
                <textarea
                  rows="3"
                  value={newCardBack}
                  onChange={(e) => setNewCardBack(e.target.value)}
                  placeholder="Enter the answer"
                  required
                />
              </label>

              <button
                className="primary-action"
                type="submit"
                disabled={flashcardSaving || flashcardsLoading}
              >
                {flashcardSaving ? "Saving..." : "+ Add Flashcard"}
              </button>
            </form>
          </div>
        </section>

        {/* STUDENT PROGRESS & PERFORMANCE OVERVIEW */}
        <section className="dashboard-section" id="progress-overview">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR LEARNING JOURNEY</span>
              <h2>Progress & Performance Overview</h2>
              <p className="section-description">A combined view of your saved quiz results, assignment submissions, attendance and recorded study time.</p>
            </div>
          </div>
          {(() => {
            const publishedAssignments = assignments.filter((item) => item.status === "published");
            const submittedCount = publishedAssignments.filter((item) => Boolean(assignmentSubmissions[item.id])).length;
            const assignmentRate = publishedAssignments.length ? Math.round(submittedCount / publishedAssignments.length * 100) : 0;
            const attendanceTotal = attendanceRecords.length;
            const attendancePresent = attendanceRecords.filter((item) => item.status === "Present" || item.status === "Late").length;
            const attendanceRate = attendanceTotal ? Math.round(attendancePresent / attendanceTotal * 100) : 0;
            const today = new Date();
            const todayKey = today.toLocaleDateString("en-CA");
            const weekStart = new Date(today);
            weekStart.setHours(0, 0, 0, 0);
            weekStart.setDate(today.getDate() - 6);
            const weekStartKey = weekStart.toLocaleDateString("en-CA");
            const weeklyMinutes = studyActivity.filter((item) => item.date >= weekStartKey && item.date <= todayKey).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
            const studyGoalRate = weeklyGoalMinutes > 0 ? Math.min(100, Math.round(weeklyMinutes / weeklyGoalMinutes * 100)) : 0;
            const indicators = [
              { label: "Quiz accuracy", value: quizHistoryLoading ? null : analytics.accuracy, detail: `${analytics.quizCount} saved quiz attempts` },
              { label: "Assignments submitted", value: assignmentsLoading ? null : assignmentRate, detail: `${submittedCount} of ${publishedAssignments.length} published assignments` },
              { label: "Attendance", value: attendanceLoading ? null : attendanceRate, detail: `${attendancePresent} of ${attendanceTotal} attended or late sessions` },
              { label: "Weekly study goal", value: learningGoalsLoading ? null : studyGoalRate, detail: `${weeklyMinutes} of ${weeklyGoalMinutes} minutes recorded this week` }
            ];
            const available = indicators.filter((item) => item.value !== null);
            const overall = available.length ? Math.round(available.reduce((sum, item) => sum + item.value, 0) / available.length) : 0;
            const busy = quizHistoryLoading || assignmentsLoading || attendanceLoading || learningGoalsLoading;
            return <>
              <div className="workspace-card" style={{ padding: 22, marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div><span className="demo-note">COMBINED INDICATOR</span><h3 style={{ margin: "5px 0", color: "#18334f" }}>Learning activity score</h3><p className="demo-note">Average of the available indicators below; it is not a course-completion certificate.</p></div>
                  <div style={{ fontSize: 38, fontWeight: 800, color: "#139b91" }}>{busy ? "—" : `${overall}%`}</div>
                </div>
                <div style={{ height: 12, background: "#e8eef4", borderRadius: 20, overflow: "hidden", marginTop: 12 }}><div style={{ width: `${busy ? 0 : overall}%`, height: "100%", background: "#139b91", borderRadius: 20, transition: "width .3s" }} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                {indicators.map((item) => <div className="workspace-card" key={item.label} style={{ padding: 18 }}>
                  <div style={{ color: "#526174", fontWeight: 700 }}>{item.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: "#18334f", margin: "8px 0" }}>{item.value === null ? "Loading…" : `${item.value}%`}</div>
                  <div style={{ height: 8, background: "#e8eef4", borderRadius: 20, overflow: "hidden" }}><div style={{ width: `${item.value || 0}%`, height: "100%", background: "#139b91" }} /></div>
                  <p className="demo-note" style={{ marginBottom: 0, marginTop: 9 }}>{item.detail}</p>
                </div>)}
              </div>
              <div className="workspace-card" style={{ padding: 20, marginTop: 18 }}>
                <h3 style={{ marginTop: 0, color: "#18334f" }}>Suggested next steps</h3>
                <ul style={{ color: "#526174", lineHeight: 1.9, paddingLeft: 22, marginBottom: 0 }}>
                  {analytics.quizCount === 0 && <li>Complete a practice quiz to start tracking quiz accuracy.</li>}
                  {publishedAssignments.length === 0 && <li>Check back when faculty publishes assignments.</li>}
                  {publishedAssignments.length > submittedCount && <li>Submit your pending assignments to improve your submission rate.</li>}
                  {attendanceTotal === 0 && <li>Attendance will appear after faculty records your class sessions.</li>}
                  {attendanceTotal > 0 && attendanceRate < 75 && <li>Attend upcoming classes regularly to improve your attendance.</li>}
                  {weeklyMinutes < weeklyGoalMinutes && <li>Record more study time to reach your weekly learning goal.</li>}
                  {available.length > 0 && available.every((item) => item.value >= 80) && <li>Great consistency. Keep practising and maintaining your progress.</li>}
                </ul>
              </div>
            </>;
          })()}
          <p className="demo-note" style={{ marginTop: 12 }}>Metrics are calculated from records already stored in your SmartLearn account. Missing records are not treated as completed work; quiz accuracy, assignment submission rate, attendance and study-goal progress are shown separately.</p>
        </section>

        {/* ANALYTICS */}
        <section className="dashboard-section" id="analytics">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR PERFORMANCE</span>
              <h2>Learning Analytics</h2>
              <p className="section-description">
                These insights are calculated from your saved Firebase quiz attempts.
              </p>
            </div>
          </div>

          {quizHistoryLoading ? (
            <div className="workspace-card"><p className="demo-note">Loading your quiz analytics...</p></div>
          ) : (
            <>
              <div className="dashboard-stats">
                {[
                  ["🧠", "Quizzes Completed", String(analytics.quizCount)],
                  ["🎯", "Overall Accuracy", `${analytics.accuracy}%`],
                  ["📝", "Questions Practised", String(analytics.totalQuestions)],
                  ["✅", "Correct Answers", String(analytics.totalCorrect)]
                ].map(([icon, label, value]) => (
                  <div className="dashboard-stat-card" key={label}>
                    <span>{icon}</span>
                    <p>{label}</p>
                    <h2>{value}</h2>
                  </div>
                ))}
              </div>

              <div className="workspace-card" style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>All-Course Learning Progress</h3>
                    <p style={{ color: "#64748b", margin: "6px 0 0" }}>Combined lesson completion across your available courses.</p>
                  </div>
                  <strong style={{ fontSize: 28, color: "#139b91" }}>{courseProgressSummary.percentage}%</strong>
                </div>
                <div style={{ height: 12, background: "#e8eef4", borderRadius: 20, overflow: "hidden", margin: "14px 0" }}>
                  <div style={{ height: "100%", width: `${courseProgressSummary.percentage}%`, background: "#139b91", borderRadius: 20, transition: "width .25s ease" }} />
                </div>
                <p style={{ color: "#64748b", margin: "0 0 16px" }}>
                  {courseProgressSummary.completedLessons} of {courseProgressSummary.totalLessons} lessons completed · {courseProgressSummary.completedCourses} of {courseProgressSummary.totalCourses} courses finished
                </p>
                {courseProgressSummary.rows.length === 0 ? (
                  <p className="demo-note">Course progress will appear after your courses load.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    {courseProgressSummary.rows.map((courseRow) => (
                      <div key={courseRow.id} style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                          <strong>{courseRow.name}</strong>
                          <span>{courseRow.percentage}%</span>
                        </div>
                        <div style={{ height: 8, background: "#e8eef4", borderRadius: 20, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${courseRow.percentage}%`, background: "#139b91", borderRadius: 20 }} />
                        </div>
                        <small style={{ color: "#64748b" }}>{courseRow.completedCount} / {courseRow.totalLessons} lessons</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Quiz Activity — Last 7 Days</h3>
                  <p>Number of quiz attempts saved each day.</p>
                  <div className="activity-bars">
                    {analytics.weeklyActivity.map((item) => (
                      <div className="activity-day" key={item.day}>
                        <div className="activity-bar" title={`${item.count} quiz attempts`}>
                          <span style={{ height: `${item.height}%` }} />
                        </div>
                        <small>{item.day}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analytics-card score-card">
                  <span>OVERALL QUIZ ACCURACY</span>
                  <strong>{analytics.quizCount ? `${analytics.accuracy}%` : "—"}</strong>
                  <p>
                    {analytics.quizCount
                      ? `${analytics.totalCorrect} correct out of ${analytics.totalQuestions} questions across ${analytics.quizCount} saved quiz attempts.`
                      : "Submit a quiz to see your learning performance here."}
                  </p>
                </div>
              </div>

              <div className="workspace-card weak-topics">
                <h3>Topic-wise Performance</h3>
                {!analytics.topics.length ? (
                  <p>There is no quiz data yet. Generate and submit a quiz to receive topic-wise insights.</p>
                ) : (
                  <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
                    {analytics.topics.map((item) => (
                      <div key={item.topic}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 7 }}>
                          <strong>{item.topic}</strong>
                          <span>{item.percentage}% · {item.correct}/{item.questions} correct</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 20, background: "#e8eef4", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${item.percentage}%`, borderRadius: 20, background: item.percentage < 60 ? "#d97706" : "#139b91" }} />
                        </div>
                        <small style={{ color: "#64748b" }}>
                          {item.percentage < 60 ? "Needs practice" : item.percentage < 80 ? "Keep revising" : "Strong topic"} · {item.quizzes} quiz attempt(s)
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* MY CERTIFICATES */}
        <section className="dashboard-section" id="certificates">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR ACHIEVEMENTS</span>
              <h2>My Certificates</h2>
              <p className="section-description">Certificates are issued after you complete every lesson in a course.</p>
            </div>
          </div>
          {certificateMessage && <p className="demo-note" role="status">{certificateMessage}</p>}
          {certificates.length === 0 ? (
            <div className="workspace-card">
              <h3>🎓 Your certificates will appear here</h3>
              <p>Complete all lessons in any course to earn your first SmartLearn AI certificate.</p>
            </div>
          ) : (
            <div className="course-grid">
              {certificates.map((certificate) => (
                <article className="course-card" key={certificate.id}>
                  <span className="course-card-icon">🏅</span>
                  <h3>{certificate.courseName}</h3>
                  <p>Completed by {certificate.studentName}</p>
                  <p>Completion date: {certificate.completionDate}</p>
                  <small>Certificate ID: {certificate.certificateId}</small>
                  <p style={{ fontSize: 13, overflowWrap: "anywhere" }}>
                    Verification: {window.location.origin}/verify/{encodeURIComponent(certificate.certificateId)}
                  </p>
                  <button type="button" className="primary-action" onClick={() => downloadCertificate(certificate)}>Download Certificate with QR (PDF)</button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* PERSONALIZED LEARNING */}
        <section className="dashboard-section" id="personalized-learning">
          <div className="dashboard-section-heading">
            <div>
              <span>BASED ON YOUR QUIZ RESULTS</span>
              <h2>Personalized Study Recommendations</h2>
              <p className="section-description">
                Suggestions combine your saved quiz performance and lesson progress across all available courses.
              </p>
            </div>
          </div>

          <div className="recommendation-list">
            {courseProgressSummary.nextCourse && (
              <div>
                <span>📚</span>
                <div>
                  <h3>Continue {courseProgressSummary.nextCourse.name}</h3>
                  <p>You've completed {courseProgressSummary.nextCourse.percentage}% of this course. Continue with its next lesson to build steady progress.</p>
                </div>
              </div>
            )}
            {!analytics.topics.length ? (
              <div>
                <span>1</span>
                <div>
                  <h3>Start with a practice quiz</h3>
                  <p>Complete and submit a quiz. SmartLearn AI will use your result to suggest what to study next.</p>
                </div>
              </div>
            ) : (
              analytics.topics.slice(0, 3).map((item, index) => (
                <div key={item.topic}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>
                      {item.percentage < 60
                        ? `Practise ${item.topic}`
                        : item.percentage < 80
                          ? `Revise ${item.topic}`
                          : `Advance your ${item.topic} skills`}
                    </h3>
                    <p>
                      {item.percentage < 60
                        ? `Your current accuracy is ${item.percentage}%. Review the topic notes, then retry a quiz.`
                        : item.percentage < 80
                          ? `Your accuracy is ${item.percentage}%. Review the explanations for missed questions and practise again.`
                          : `Your accuracy is ${item.percentage}%. Try a more challenging quiz to keep progressing.`}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div>
              <span>{analytics.topics.length ? analytics.topics.length + 1 : 2}</span>
              <div>
                <h3>Keep a steady study routine</h3>
                <p>Use your Study Planner, summaries and flashcards to reinforce what you learn.</p>
              </div>
            </div>
          </div>
        </section>

        {/* STUDY PLANNER */}
        <section className="dashboard-section" id="study-planner">
          <div className="dashboard-section-heading">
            <div>
              <span>STAY ORGANIZED</span>
              <h2>Study Planner</h2>
              <p className="section-description">
                Your study tasks are saved in Firebase Firestore.
              </p>
            </div>
          </div>

          <div className="workspace-card" style={{ padding: 20 }}>
            {(() => {
              const completedTasks = tasks.filter((task) => task.done).length;
              const pendingTasks = tasks.filter((task) => !task.done);
              const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
              const urgentTask = [...pendingTasks].sort((a, b) => {
                const rank = { High: 0, Medium: 1, Low: 2 };
                return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
              })[0];
              return <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12, marginBottom: 20 }}>
                  <div style={{ background: "#f1f7fb", borderRadius: 12, padding: 14 }}><small style={{ color: "#64748b" }}>Total tasks</small><h3 style={{ margin: "5px 0", color: "#18334f" }}>{tasks.length}</h3></div>
                  <div style={{ background: "#effaf5", borderRadius: 12, padding: 14 }}><small style={{ color: "#64748b" }}>Completed</small><h3 style={{ margin: "5px 0", color: "#167345" }}>{completedTasks}</h3></div>
                  <div style={{ background: "#fff7e8", borderRadius: 12, padding: 14 }}><small style={{ color: "#64748b" }}>Still to do</small><h3 style={{ margin: "5px 0", color: "#946200" }}>{pendingTasks.length}</h3></div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}><strong style={{ color: "#18334f" }}>Study plan progress</strong><strong style={{ color: "#139b91" }}>{completionRate}%</strong></div>
                  <div role="progressbar" aria-valuenow={completionRate} aria-valuemin={0} aria-valuemax={100} style={{ height: 10, borderRadius: 20, background: "#e8eef4", overflow: "hidden" }}><div style={{ width: `${completionRate}%`, height: "100%", background: "#13a69b", borderRadius: 20, transition: "width .2s" }} /></div>
                </div>
                <form onSubmit={addTask} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, alignItems: "end", paddingBottom: 18, borderBottom: "1px solid #e8eef4" }}>
                  <label className="full-label" style={{ margin: 0 }}>Task name
                    <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Revise data structures" required maxLength={120} />
                  </label>
                  <label className="full-label" style={{ margin: 0 }}>Course
                    <select value={taskCourse} onChange={(e) => setTaskCourse(e.target.value)}>
                      {["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management", "General Study"].map((course) => <option key={course}>{course}</option>)}
                    </select>
                  </label>
                  <label className="full-label" style={{ margin: 0 }}>Due
                    <select value={taskDue} onChange={(e) => setTaskDue(e.target.value)}>
                      <option>Today</option><option>Tomorrow</option><option>This week</option><option>Next week</option>
                    </select>
                  </label>
                  <label className="full-label" style={{ margin: 0 }}>Priority
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                      <option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </label>
                  <label className="full-label" style={{ margin: 0 }}>Study time
                    <select value={taskDuration} onChange={(e) => setTaskDuration(e.target.value)}>
                      <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option>
                    </select>
                  </label>
                  <button className="primary-action" type="submit" disabled={taskSaving}>{taskSaving ? "Saving..." : "+ Add Study Task"}</button>
                </form>
                {taskMessage && <p className="success-message" role="status">{taskMessage}</p>}
                {taskError && <p className="auth-error" role="alert">{taskError}</p>}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 20 }}>
                  <h3 style={{ color: "#18334f", margin: 0 }}>My study tasks</h3>
                  <span className="demo-note">{tasks.length} saved task(s)</span>
                </div>
                {tasksLoading ? <p className="demo-note">Loading your saved tasks...</p> : !tasks.length ? <p className="demo-note">No study tasks yet. Add your first task above!</p> : <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  {tasks.map((task) => <div key={task.id} className={`task-item ${task.done ? "task-done" : ""}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: "1px solid #e3eaf0", borderRadius: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
                      <input type="checkbox" checked={Boolean(task.done)} onChange={() => toggleTask(task)} />
                      <span style={{ minWidth: 0 }}><strong style={{ display: "block", color: "#18334f", overflowWrap: "anywhere" }}>{task.title}</strong><small style={{ color: "#64748b" }}>{task.course || "General Study"} · {task.due || "No due date"} · {task.durationMinutes || 30} min</small></span>
                    </label>
                    <span style={{ fontSize: 11, fontWeight: 800, color: task.priority === "High" ? "#b42318" : task.priority === "Low" ? "#167345" : "#946200", background: task.priority === "High" ? "#fff1f0" : task.priority === "Low" ? "#effaf5" : "#fff7e8", borderRadius: 20, padding: "5px 8px" }}>{task.priority || "Medium"}</span>
                    <button type="button" aria-label={`Delete ${task.title}`} onClick={() => removeTask(task.id)} style={{ border: 0, background: "transparent", color: "#b42318", cursor: "pointer", fontSize: 18 }}>✕</button>
                  </div>)}
                </div>}
                <div style={{ marginTop: 18, padding: 15, borderRadius: 12, background: "#f2f8fb", borderLeft: "4px solid #13a69b" }}>
                  <strong style={{ color: "#18334f" }}>Smart study suggestion</strong>
                  <p style={{ color: "#526174", margin: "6px 0 0", lineHeight: 1.5 }}>{urgentTask ? `Start with “${urgentTask.title}” in ${urgentTask.course || "your course"} because it is your highest-priority pending task. Set aside about ${urgentTask.durationMinutes || 30} minutes, then mark it complete.` : tasks.length ? "Great work — all your planned tasks are complete. Add your next learning task to keep your momentum going." : "Add your first task, choose its course and priority, then work through your plan one task at a time."}</p>
                </div>
              </>;
            })()}
          </div>
        </section>

        {/* WEEKLY STUDY TIMETABLE */}
        <section className="dashboard-section" id="weekly-timetable">
          <div className="dashboard-section-heading">
            <div>
              <span>PLAN YOUR WEEK</span>
              <h2>Weekly Study Timetable</h2>
              <p className="section-description">Plan study sessions from Monday to Sunday. Your timetable is saved to Firebase.</p>
            </div>
          </div>

          <div className="workspace-card">
            <form onSubmit={saveTimetableSession} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "end" }}>
              <label className="full-label" style={{ margin: 0 }}>
                Subject / Study topic
                <input value={sessionSubject} onChange={(event) => setSessionSubject(event.target.value)} placeholder="e.g. Python functions" required />
              </label>
              <label className="full-label" style={{ margin: 0 }}>
                Day
                <select value={sessionDay} onChange={(event) => setSessionDay(event.target.value)}>
                  {timetableDays.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label className="full-label" style={{ margin: 0 }}>
                Start time
                <input type="time" value={sessionStart} onChange={(event) => setSessionStart(event.target.value)} required />
              </label>
              <label className="full-label" style={{ margin: 0 }}>
                End time
                <input type="time" value={sessionEnd} onChange={(event) => setSessionEnd(event.target.value)} required />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="primary-action" type="submit" disabled={sessionSaving}>{sessionSaving ? "Saving..." : editingSessionId ? "Update Session" : "+ Add Session"}</button>
                {editingSessionId && <button className="secondary-action" type="button" onClick={() => { setEditingSessionId(null); setSessionSubject(""); setSessionDay(todayDayName); setSessionStart("09:00"); setSessionEnd("10:00"); setTimetableMessage("Edit cancelled."); }}>Cancel</button>}
              </div>
            </form>

            {timetableMessage && <p className="success-message" role="status">{timetableMessage}</p>}
            {timetableError && <p className="auth-error" role="alert">{timetableError}</p>}
            {timetableLoading ? <p className="demo-note">Loading your weekly timetable...</p> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 20 }}>
                {timetableDays.map((day) => {
                  const daySessions = timetableEntries.filter((session) => session.day === day).sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
                  const isToday = day === todayDayName;
                  return (
                    <div key={day} style={{ border: isToday ? "2px solid #139b91" : "1px solid #dce5ee", borderRadius: 12, padding: 14, background: isToday ? "#f0fbf9" : "#fff", minHeight: 120 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <strong style={{ color: "#18334f" }}>{day}</strong>
                        {isToday && <span style={{ fontSize: 11, fontWeight: 700, color: "#087f75", background: "#d8f5ef", padding: "4px 8px", borderRadius: 20 }}>TODAY</span>}
                      </div>
                      {daySessions.length === 0 ? <p className="demo-note" style={{ margin: 0 }}>No sessions planned.</p> : daySessions.map((session) => (
                        <div key={session.id} style={{ border: "1px solid #e3eaf0", borderRadius: 9, padding: 10, marginTop: 8, background: "#fff" }}>
                          <strong style={{ display: "block", color: "#18334f", overflowWrap: "anywhere" }}>{session.subject}</strong>
                          <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 4 }}>{session.startTime} – {session.endTime}</span>
                          <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                            <button type="button" className="secondary-action" onClick={() => editTimetableSession(session)}>Edit</button>
                            <button type="button" className="secondary-action" style={{ color: "#b42318" }} onClick={() => deleteTimetableSession(session.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {!timetableLoading && timetableEntries.length === 0 && <p className="demo-note" style={{ marginTop: 14 }}>Your week is empty. Add your first study session above.</p>}
            <p className="demo-note" style={{ marginTop: 14 }}>Each signed-in student has a separate timetable stored in <code>users/{"{uid}"}/timetable</code> in Firestore.</p>
          </div>
        </section>

        {/* LEARNING GOALS & STUDY STREAKS */}
        <section className="dashboard-section" id="learning-goals">
          <div className="dashboard-section-heading">
            <div>
              <span>BUILD A CONSISTENT ROUTINE</span>
              <h2>Learning Goals & Study Streaks</h2>
              <p className="section-description">Set daily and weekly targets, record your study time and celebrate your progress.</p>
            </div>
          </div>
          {(() => {
            const now = new Date();
            const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
            const weekStartKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
            const dailyMinutes = studyActivity.filter((item) => item.date === todayKey).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
            const weeklyMinutes = studyActivity.filter((item) => item.date >= weekStartKey && item.date <= todayKey).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
            const activeDates = new Set(studyActivity.map((item) => item.date).filter(Boolean));
            let streak = 0;
            const streakDate = new Date(now);
            if (!activeDates.has(todayKey)) streakDate.setDate(streakDate.getDate() - 1);
            while (streak < 365) {
              const key = `${streakDate.getFullYear()}-${String(streakDate.getMonth() + 1).padStart(2, "0")}-${String(streakDate.getDate()).padStart(2, "0")}`;
              if (!activeDates.has(key)) break;
              streak += 1;
              streakDate.setDate(streakDate.getDate() - 1);
            }
            const dailyPercent = Math.min(100, Math.round(dailyMinutes / Math.max(1, Number(dailyGoalMinutes)) * 100));
            const weeklyPercent = Math.min(100, Math.round(weeklyMinutes / Math.max(1, Number(weeklyGoalMinutes)) * 100));
            const calendarDays = Array.from({ length: 14 }, (_, index) => {
              const day = new Date(now);
              day.setDate(now.getDate() - (13 - index));
              const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const minutes = studyActivity.filter((item) => item.date === key).reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
              return { key, label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), minutes, today: key === todayKey };
            });
            const badges = [
              { name: "First Steps", detail: "Log your first study day", icon: "🌱", unlocked: activeDates.size > 0 },
              { name: "3-Day Streak", detail: "Study 3 days in a row", icon: "🔥", unlocked: streak >= 3 },
              { name: "7-Day Streak", detail: "Study 7 days in a row", icon: "🏅", unlocked: streak >= 7 },
              { name: "Goal Getter", detail: "Reach your daily target", icon: "⭐", unlocked: dailyMinutes >= Number(dailyGoalMinutes) }
            ];
            return <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
                {[
                  { label: "Today's study time", value: `${dailyMinutes} min`, icon: "📚", tint: "#e8f7f5" },
                  { label: "This week's study time", value: `${weeklyMinutes} min`, icon: "📅", tint: "#eef4ff" },
                  { label: "Current study streak", value: `${streak} ${streak === 1 ? "day" : "days"}`, icon: "🔥", tint: "#fff3e8" }
                ].map((stat) => <div key={stat.label} className="workspace-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 44, height: 44, borderRadius: 12, background: stat.tint, display: "grid", placeItems: "center", fontSize: 21 }}>{stat.icon}</span><div><strong style={{ display: "block", color: "#18334f", fontSize: 22 }}>{stat.value}</strong><span style={{ color: "#64748b", fontSize: 12 }}>{stat.label}</span></div></div>)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 18 }}>
                <div className="workspace-card">
                  <h3 style={{ color: "#18334f", marginTop: 0 }}>Set your learning goals</h3>
                  <form onSubmit={saveLearningGoals} style={{ display: "grid", gap: 12 }}>
                    <label className="full-label">Daily study goal (minutes)<input type="number" min="1" max="1440" value={dailyGoalMinutes} onChange={(event) => setDailyGoalMinutes(event.target.value)} required /></label>
                    <label className="full-label">Weekly study goal (minutes)<input type="number" min="1" max="10080" value={weeklyGoalMinutes} onChange={(event) => setWeeklyGoalMinutes(event.target.value)} required /></label>
                    <button type="submit" className="primary-action" disabled={goalSaving}>{goalSaving ? "Saving..." : "Save Learning Goals"}</button>
                  </form>
                  <p className="demo-note">Example: 60 minutes daily and 300 minutes weekly.</p>
                </div>
                <div className="workspace-card">
                  <h3 style={{ color: "#18334f", marginTop: 0 }}>Record today's study time</h3>
                  <p className="demo-note">Add the minutes you studied today. You can record more than one session.</p>
                  <form onSubmit={logStudyMinutes} style={{ display: "grid", gap: 12 }}>
                    <label className="full-label">Study duration (minutes)<input type="number" min="1" max="1440" value={studyMinutesInput} onChange={(event) => setStudyMinutesInput(event.target.value)} required /></label>
                    <button type="submit" className="primary-action" disabled={activitySaving}>{activitySaving ? "Saving..." : "+ Log Study Time"}</button>
                  </form>
                  <p className="demo-note">Record only time you actually spent studying.</p>
                </div>
              </div>

              <div className="workspace-card" style={{ marginBottom: 18 }}>
                <h3 style={{ color: "#18334f", marginTop: 0 }}>Your goal progress</h3>
                <div style={{ marginBottom: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}><strong>Daily goal</strong><span style={{ color: "#64748b" }}>{dailyMinutes} / {dailyGoalMinutes} min ({dailyPercent}%)</span></div><div style={{ height: 12, borderRadius: 20, background: "#e8eef4", overflow: "hidden" }}><div style={{ width: `${dailyPercent}%`, height: "100%", background: "#13a69b", borderRadius: 20 }} /></div></div>
                <div><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 7 }}><strong>Weekly goal</strong><span style={{ color: "#64748b" }}>{weeklyMinutes} / {weeklyGoalMinutes} min ({weeklyPercent}%)</span></div><div style={{ height: 12, borderRadius: 20, background: "#e8eef4", overflow: "hidden" }}><div style={{ width: `${weeklyPercent}%`, height: "100%", background: "#183e5c", borderRadius: 20 }} /></div></div>
              </div>

              <div className="workspace-card" style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}><h3 style={{ color: "#18334f", marginTop: 0 }}>Learning activity calendar</h3><span className="demo-note">Last 14 days</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 9 }}>{calendarDays.map((day) => <div key={day.key} title={`${day.key}: ${day.minutes} study minutes`} style={{ textAlign: "center", padding: "12px 4px", borderRadius: 10, background: day.minutes > 0 ? "#dff6f2" : "#f4f7fa", border: day.today ? "2px solid #139b91" : "1px solid #e2e8f0" }}><strong style={{ display: "block", color: "#18334f", fontSize: 12 }}>{day.label}</strong><span style={{ display: "block", color: day.minutes > 0 ? "#087f75" : "#94a3b8", fontSize: 11, marginTop: 5 }}>{day.minutes}m</span></div>)}</div>
              </div>

              <div className="workspace-card">
                <h3 style={{ color: "#18334f", marginTop: 0 }}>Achievement badges</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>{badges.map((badge) => <div key={badge.name} style={{ padding: 14, borderRadius: 12, border: `1px solid ${badge.unlocked ? "#b8e7dc" : "#e2e8f0"}`, background: badge.unlocked ? "#effbf8" : "#f8fafc", opacity: badge.unlocked ? 1 : 0.68 }}><div style={{ fontSize: 25 }}>{badge.icon}</div><strong style={{ display: "block", color: "#18334f", marginTop: 6 }}>{badge.name}</strong><span style={{ color: "#64748b", fontSize: 12 }}>{badge.detail}</span><span style={{ display: "block", color: badge.unlocked ? "#087f75" : "#94a3b8", fontSize: 11, fontWeight: 700, marginTop: 8 }}>{badge.unlocked ? "UNLOCKED" : "LOCKED"}</span></div>)}</div>
              </div>
            </>;
          })()}
          {learningGoalsLoading && <p className="demo-note">Loading your learning goals...</p>}
          {goalMessage && <p className="success-message" role="status">{goalMessage}</p>}
          {goalError && <p className="auth-error" role="alert">{goalError}</p>}
          <p className="demo-note" style={{ marginTop: 14 }}>Goals are saved in your private Firebase account under learningGoals/settings. Study records are stored in studyActivity. Streaks count consecutive dates with recorded study time.</p>
        </section>

        {/* ATTENDANCE MANAGEMENT */}
        <section className="dashboard-section" id="attendance">
          <div className="dashboard-section-heading">
            <div><span>CLASS PARTICIPATION</span><h2>Attendance Management</h2><p className="section-description">Track class attendance and review your attendance history.</p></div>
            <span className="settings-status">{attendanceRecords.length} records</span>
          </div>
          {attendanceError && <p className="auth-error" role="alert">{attendanceError}</p>}
          {attendanceMessage && <p className="success-message" role="status">{attendanceMessage}</p>}
          { ["faculty", "admin"].includes(accountRole) && <form className="workspace-card" onSubmit={saveAttendance} style={{ padding: 20, marginBottom: 18 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>Mark student attendance</h3>
            <p className="demo-note">Enter the student's Firebase Authentication UID. Students can find their UID only through an authorized faculty/admin workflow.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, color: "#526174", fontSize: 13 }}>Student Firebase UID<input value={attendanceStudentId} onChange={(e) => setAttendanceStudentId(e.target.value)} placeholder="Paste student UID" required /></label>
              <label style={{ display: "grid", gap: 6, color: "#526174", fontSize: 13 }}>Student name<input value={attendanceStudentName} onChange={(e) => setAttendanceStudentName(e.target.value)} placeholder="Student full name" required /></label>
              <label style={{ display: "grid", gap: 6, color: "#526174", fontSize: 13 }}>Course<select value={attendanceCourse} onChange={(e) => setAttendanceCourse(e.target.value)}>{["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label style={{ display: "grid", gap: 6, color: "#526174", fontSize: 13 }}>Date<input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} required /></label>
              <label style={{ display: "grid", gap: 6, color: "#526174", fontSize: 13 }}>Status<select value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value)}><option>Present</option><option>Absent</option><option>Late</option></select></label>
            </div>
            <button className="primary-action" type="submit" disabled={attendanceSaving} style={{ marginTop: 14 }}>{attendanceSaving ? "Saving..." : "Save Attendance"}</button>
          </form> }
          {attendanceLoading ? <p className="demo-note">Loading attendance records...</p> : <>
            <div className="dashboard-stats" style={{ marginBottom: 18 }}>
              {(() => { const present = attendanceRecords.filter((r) => r.status === "Present").length; const absent = attendanceRecords.filter((r) => r.status === "Absent").length; const total = attendanceRecords.length; const percent = total ? Math.round((present / total) * 100) : 0; return [["✅", "Present", present], ["❌", "Absent", absent], ["📊", "Attendance", `${percent}%`]].map(([icon, label, value]) => <div className="dashboard-stat-card" key={label}><span>{icon}</span><p>{label}</p><h2>{value}</h2></div>); })()}
            </div>
            <div className="workspace-card" style={{ padding: 18 }}>
              <h3 style={{ color: "#18334f", marginTop: 0 }}>Attendance history</h3>
              {!attendanceRecords.length ? <p className="demo-note">No attendance records yet. Faculty attendance entries will appear here.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Date", ...( ["faculty", "admin"].includes(accountRole) ? ["Student"] : []), "Course", "Status"].map((h) => <th key={h} style={{ padding: 11, color: "#526174", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}</tr></thead><tbody>{attendanceRecords.map((r) => <tr key={r.id}><td style={{ padding: 11, borderBottom: "1px solid #eef2f6" }}>{r.date || "—"}</td>{["faculty", "admin"].includes(accountRole) && <td style={{ padding: 11, borderBottom: "1px solid #eef2f6" }}>{r.studentName || r.studentId}</td>}<td style={{ padding: 11, borderBottom: "1px solid #eef2f6" }}>{r.course || "—"}</td><td style={{ padding: 11, borderBottom: "1px solid #eef2f6", fontWeight: 700, color: r.status === "Present" ? "#087f75" : r.status === "Absent" ? "#b42318" : "#b7791f" }}>{r.status || "—"}</td></tr>)}</tbody></table></div>}
            </div>
          </>}
          <p className="demo-note" style={{ marginTop: 12 }}>Attendance records are stored in the Firestore attendance collection. Students can read records matching their own Firebase UID.</p>
        </section>

        {/* ANNOUNCEMENTS & NOTIFICATIONS */}
        <section className="dashboard-section" id="announcements">
          <div className="dashboard-section-heading">
            <div><span>STAY UPDATED</span><h2>Announcements & Notifications</h2><p className="section-description">Important updates published by your faculty for your courses.</p></div>
            <span className="settings-status">{publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement" && !announcementReads[item.id]).length} unread</span>
          </div>
          {announcementError && <p className="auth-error" role="alert">{announcementError}</p>}
          {announcementReadLoading ? <p className="demo-note">Loading notification status...</p> : null}
          {(() => {
            const announcements = publishedCourseContent.filter((item) => String(item.type || "").toLowerCase() === "announcement");
            if (!announcements.length) return <div className="workspace-card" style={{ padding: 24, textAlign: "center" }}><div style={{ fontSize: 34 }}>📣</div><h3 style={{ color: "#18334f" }}>No announcements yet</h3><p className="demo-note">Faculty announcements will appear here when they are published.</p></div>;
            return <div style={{ display: "grid", gap: 12 }}>{announcements.map((item) => {
              const isRead = Boolean(announcementReads[item.id]);
              const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "Recently published";
              return <article key={item.id} className="workspace-card" style={{ padding: 18, borderLeft: `4px solid ${isRead ? "#cbd5e1" : "#13a69b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><span className="course-card-meta">{item.course || "All courses"}</span><h3 style={{ color: "#18334f", margin: "8px 0 4px" }}>{item.title}</h3></div><span className="settings-status">{isRead ? "READ" : "NEW"}</span></div>
                {item.description && <p style={{ color: "#526174" }}>{item.description}</p>}
                <p style={{ color: "#526174", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{item.content || ""}</p>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><small className="demo-note">Published: {date}</small>{!isRead && <button type="button" className="primary-action" onClick={() => markAnnouncementRead(item)}>Mark as read</button>}</div>
              </article>;
            })}</div>;
          })()}
          <p className="demo-note" style={{ marginTop: 12 }}>Announcement content is loaded from the existing published courseContent collection. Your read status is saved privately in users/your-user-id/announcementReads.</p>
        </section>

        {/* STUDY REMINDERS & NOTIFICATION CENTER */}
        <section className="dashboard-section" id="study-reminders">
          <div className="dashboard-section-heading">
            <div>
              <span>STAY ON TRACK</span>
              <h2>Study Reminders & Notifications</h2>
              <p className="section-description">Plan study sessions, quiz preparation and assignment deadlines. Your reminders are saved privately to your student account.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 18 }}>
            {[
              { label: "Total reminders", value: reminders.length, icon: "🔔", tint: "#eef6ff" },
              { label: "Upcoming", value: reminders.filter((item) => !item.completed && `${item.date || ""}T${item.time || "00:00"}` >= `${new Date().toLocaleDateString("en-CA")}T${new Date().toTimeString().slice(0, 5)}`).length, icon: "⏰", tint: "#f0fbf8" },
              { label: "Completed", value: reminders.filter((item) => item.completed).length, icon: "✅", tint: "#f3f0ff" }
            ].map((stat) => (
              <div key={stat.label} className="workspace-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: stat.tint, display: "grid", placeItems: "center", fontSize: 20 }}>{stat.icon}</span>
                <div><strong style={{ display: "block", color: "#18334f", fontSize: 23 }}>{stat.value}</strong><span style={{ color: "#64748b", fontSize: 12 }}>{stat.label}</span></div>
              </div>
            ))}
          </div>

          <div className="workspace-card" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: "#e8f7f5", display: "grid", placeItems: "center", fontSize: 21 }}>🗓️</span>
              <div><h3 style={{ margin: 0, color: "#18334f" }}>{editingReminderId ? "Edit Reminder" : "Create a Reminder"}</h3><p className="demo-note" style={{ margin: "4px 0 0" }}>Choose what you need to remember and when.</p></div>
            </div>
            <form onSubmit={saveReminder} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end" }}>
              <label className="full-label" style={{ margin: 0, gridColumn: "span 2" }}>Reminder title<input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="e.g. Revise Python loops" maxLength={100} required /></label>
              <label className="full-label" style={{ margin: 0 }}>Category<select value={reminderCategory} onChange={(event) => setReminderCategory(event.target.value)}><option>Study Session</option><option>Quiz Preparation</option><option>Assignment</option><option>Course Revision</option><option>Project Work</option><option>Other</option></select></label>
              <label className="full-label" style={{ margin: 0 }}>Date<input type="date" value={reminderDate} onChange={(event) => setReminderDate(event.target.value)} min={new Date().toLocaleDateString("en-CA")} required /></label>
              <label className="full-label" style={{ margin: 0 }}>Time<input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} required /></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary-action" type="submit" disabled={reminderSaving}>{reminderSaving ? "Saving..." : editingReminderId ? "Update Reminder" : "+ Add Reminder"}</button>{editingReminderId && <button className="secondary-action" type="button" onClick={() => { setEditingReminderId(null); setReminderTitle(""); setReminderCategory("Study Session"); setReminderDate(new Date().toLocaleDateString("en-CA")); setReminderTime("18:00"); setReminderMessage("Edit cancelled."); }}>Cancel</button>}</div>
            </form>
            {reminderMessage && <p className="success-message" role="status">{reminderMessage}</p>}
            {reminderError && <p className="auth-error" role="alert">{reminderError}</p>}
          </div>

          <div className="workspace-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div><h3 style={{ margin: 0, color: "#18334f" }}>Notification Center</h3><p className="demo-note" style={{ margin: "4px 0 0" }}>Your scheduled reminders and completed activities.</p></div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {[ ["upcoming", "Upcoming"], ["all", "All reminders"], ["completed", "Completed"] ].map(([value, label]) => <button key={value} type="button" className={reminderFilter === value ? "primary-action" : "secondary-action"} onClick={() => setReminderFilter(value)}>{label}</button>)}
              </div>
            </div>
            {remindersLoading ? <p className="demo-note">Loading your reminders...</p> : reminders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 16px", border: "1px dashed #cbd5e1", borderRadius: 14, background: "#fbfdff" }}><div style={{ fontSize: 34, marginBottom: 8 }}>🔔</div><h3 style={{ color: "#18334f", margin: "0 0 6px" }}>No reminders yet</h3><p className="demo-note" style={{ margin: 0 }}>Create your first reminder above to keep your learning on schedule.</p></div>
            ) : (() => {
              const nowKey = `${new Date().toLocaleDateString("en-CA")}T${new Date().toTimeString().slice(0, 5)}`;
              const visibleReminders = reminders.filter((item) => reminderFilter === "all" || (reminderFilter === "completed" ? item.completed : !item.completed));
              return visibleReminders.length === 0 ? <p className="demo-note">There are no reminders in this view.</p> : <div style={{ display: "grid", gap: 10 }}>
                {visibleReminders.map((reminder) => {
                  const dueKey = `${reminder.date || ""}T${reminder.time || "00:00"}`;
                  const overdue = !reminder.completed && dueKey < nowKey;
                  const dateLabel = reminder.date ? new Date(`${reminder.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Date not set";
                  return <article key={reminder.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 15, border: "1px solid #e1e9f0", borderLeft: `4px solid ${reminder.completed ? "#16a34a" : overdue ? "#e59a32" : "#139b91"}`, borderRadius: 12, background: reminder.completed ? "#f8fafc" : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "1 1 240px" }}>
                      <span style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: 11, display: "grid", placeItems: "center", background: reminder.completed ? "#e9f8ee" : overdue ? "#fff5e8" : "#eaf8f6", fontSize: 18 }}>{reminder.completed ? "✓" : overdue ? "!" : "🔔"}</span>
                      <div style={{ minWidth: 0 }}><strong style={{ display: "block", color: "#18334f", textDecoration: reminder.completed ? "line-through" : "none", overflowWrap: "anywhere" }}>{reminder.title}</strong><span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 4 }}>{reminder.category || "Study Session"} · {dateLabel} · {reminder.time || "Time not set"}</span><span style={{ display: "inline-block", marginTop: 7, padding: "4px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: reminder.completed ? "#166534" : overdue ? "#9a5800" : "#087f75", background: reminder.completed ? "#dcfce7" : overdue ? "#fff0d9" : "#dff6f2" }}>{reminder.completed ? "COMPLETED" : overdue ? "PAST DUE" : "UPCOMING"}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><button type="button" className="secondary-action" onClick={() => toggleReminder(reminder)}>{reminder.completed ? "Reopen" : "Mark completed"}</button><button type="button" className="secondary-action" onClick={() => editReminder(reminder)}>Edit</button><button type="button" className="secondary-action" style={{ color: "#b42318" }} onClick={() => deleteReminder(reminder.id)}>Delete</button></div>
                  </article>;
                })}
              </div>;
            })()}
            <p className="demo-note" style={{ marginTop: 14 }}>Reminders are stored in <code>users/{"{uid}"}/reminders</code>. This is an in-app notification center; it does not send device push notifications.</p>
          </div>
        </section>

        {/* MY PROFILE */}
        <section className="dashboard-section" id="profile">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR ACCOUNT</span>
              <h2>My Profile</h2>
              <p className="section-description">
                Your profile information is saved in Firebase Firestore.
              </p>
            </div>
          </div>

          <form className="workspace-card profile-form" onSubmit={saveProfile}>
            {profileLoading ? (
              <p className="demo-note">Loading your profile...</p>
            ) : (
              <>
                <label>
                  Student name
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        name: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                  />
                </label>

                <label>
                  Learning goal
                  <input
                    type="text"
                    value={profile.goal}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        goal: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <button
                  className="primary-action"
                  type="submit"
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving..." : "Save Profile"}
                </button>
              </>
            )}

            {profileMessage && (
              <p className="success-message">{profileMessage}</p>
            )}

            {profileError && (
              <p className="auth-error">{profileError}</p>
            )}
          </form>
        </section>

        {/* STUDY MATERIALS LIBRARY */}
        <section className="dashboard-section" id="study-materials">
          <div className="dashboard-section-heading">
            <div>
              <span>YOUR PERSONAL LIBRARY</span>
              <h2>Study Materials</h2>
              <p className="section-description">Save notes by course, then reuse them for summaries and quiz generation.</p>
            </div>
          </div>

          {publishedCourseContent.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div className="dashboard-section-heading"><div><h3>Published course resources</h3><p className="section-description">Lessons and materials shared by your faculty.</p></div></div>
              <div className="dashboard-course-grid">
                {publishedCourseContent.map((item) => (
                  <article className="dashboard-course-card" key={item.id}>
                    <div className="course-card-meta"><span>{item.course}</span><span>{item.type}</span></div>
                    <h3>{item.title}</h3>
                    <p>{item.description || (item.content || "").slice(0, 180)}</p>
                    <details><summary>Read content</summary><p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p></details>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="workspace-card" style={{ padding: 22, marginBottom: 22 }}>
            <form onSubmit={saveStudyMaterial} style={{ display: "grid", gap: 14 }}>
              <label>Material title
                <input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="e.g. Python Variables and Data Types" required />
              </label>
              <label>Course
                <select value={materialCourse} onChange={(event) => setMaterialCourse(event.target.value)}>
                  {(["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"]).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label>Upload notes (.txt or .md)
                <input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importMaterialFile} />
              </label>
              <label>Study notes / material content
                <textarea value={materialContent} onChange={(event) => setMaterialContent(event.target.value)} rows={7} placeholder="Paste your lecture notes or study material here..." required />
              </label>
              <button className="primary-action" type="submit" disabled={materialSaving}>{materialSaving ? "Saving..." : "Save Material to Firebase"}</button>
            </form>
            <p className="demo-note">PDF files are not parsed automatically in this version. Copy text from a PDF into the notes box, or use a .txt/.md file.</p>
            {materialMessage && <p className="success-message">{materialMessage}</p>}
            {materialError && <p className="auth-error">{materialError}</p>}
          </div>

          <div className="dashboard-section-heading" style={{ marginTop: 18 }}>
            <div><h3>My saved materials ({studyMaterials.length})</h3></div>
            <input aria-label="Search study materials" value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search by title or course..." style={{ maxWidth: 320 }} />
          </div>
          {materialsLoading ? <p className="demo-note">Loading saved materials...</p> : null}
          {!materialsLoading && studyMaterials.filter((item) => `${item.title} ${item.course}`.toLowerCase().includes(materialSearch.toLowerCase())).length === 0 && <p className="demo-note">No saved materials found. Add your first set of notes above.</p>}
          <div className="dashboard-course-grid">
            {studyMaterials.filter((item) => `${item.title} ${item.course}`.toLowerCase().includes(materialSearch.toLowerCase())).map((item) => (
              <article className="dashboard-course-card" key={item.id}>
                <div className="dashboard-course-icon">📄</div>
                <div className="course-card-meta"><span>{item.course}</span><span>Saved notes</span></div>
                <h3>{item.title}</h3>
                <p>{item.content.slice(0, 150)}{item.content.length > 150 ? "..." : ""}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" onClick={() => { setNoteText(item.content); setSummary(""); goTo("summarizer"); }}>Create Summary</button>
                  <button type="button" onClick={() => { setQuizNotes(item.content); setQuizTopic(item.course); setQuizError(""); goTo("quiz-generator"); }}>Generate Quiz</button>
                  <button type="button" onClick={() => deleteStudyMaterial(item.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FEATURE 14 — SMART LEARNING RESOURCES LIBRARY */}
        <section className="dashboard-section" id="learning-resources">
          <div className="dashboard-section-heading">
            <div><span>COURSE-WISE RESOURCE HUB</span><h2>Smart Learning Resources Library</h2><p className="section-description">Find course notes, presentations, documents and video lessons shared by your faculty.</p></div>
            <span className="settings-status">{learningResources.length} resource{learningResources.length === 1 ? "" : "s"}</span>
          </div>
          {learningResourceMessage && <p className="success-message" role="status">{learningResourceMessage}</p>}
          {learningResourceError && <p className="auth-error" role="alert">{learningResourceError}</p>}
          { ["faculty", "admin"].includes(accountRole) && <div className="workspace-card" style={{ padding: 22, marginBottom: 20 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>{editingLearningResourceId ? "Edit learning resource" : "Publish a learning resource"}</h3>
            <form onSubmit={saveLearningResource} style={{ display: "grid", gap: 12 }}>
              <label className="full-label">Resource title<input value={learningResourceTitle} onChange={(e) => setLearningResourceTitle(e.target.value)} placeholder="e.g. Python functions — lecture notes" required /></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
                <label className="full-label">Course<select value={learningResourceCourse} onChange={(e) => setLearningResourceCourse(e.target.value)}>{learningResourceCourses.map((course) => <option key={course}>{course}</option>)}</select></label>
                <label className="full-label">Subject / topic<input value={learningResourceSubject} onChange={(e) => setLearningResourceSubject(e.target.value)} placeholder="e.g. Functions and modules" /></label>
                <label className="full-label">Learning level<select value={learningResourceLevel} onChange={(e) => setLearningResourceLevel(e.target.value)}><option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Advanced">Advanced</option></select></label>
                <label className="full-label">Resource type<select value={learningResourceType} onChange={(e) => setLearningResourceType(e.target.value)}><option value="file">Document / notes</option><option value="video">Video link</option></select></label>
              </div>
              <label className="full-label">Description<textarea rows={2} value={learningResourceDescription} onChange={(e) => setLearningResourceDescription(e.target.value)} placeholder="What will students learn from this resource?" /></label>
              {learningResourceType === "file" ? <label className="full-label">Upload file (PDF, PPT, PPTX, DOC, DOCX, TXT, MD — max 25 MB)<input id="learning-resource-file" type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.md" onChange={(e) => setLearningResourceFile(e.target.files?.[0] || null)} />{learningResourceFile && <small>{learningResourceFile.name} · {(learningResourceFile.size / 1024 / 1024).toFixed(2)} MB</small>}</label> : <label className="full-label">Video URL<input type="url" value={learningResourceUrl} onChange={(e) => setLearningResourceUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." required /></label>}
              <label className="full-label">Publication status<select value={learningResourceStatus} onChange={(e) => setLearningResourceStatus(e.target.value)}><option value="published">Published — visible to students</option><option value="draft">Draft — faculty/admin only</option></select></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary-action" type="submit" disabled={learningResourceSaving}>{learningResourceSaving ? "Saving..." : editingLearningResourceId ? "Update Resource" : "Publish Resource"}</button>{editingLearningResourceId && <button className="secondary-action" type="button" onClick={() => { setEditingLearningResourceId(null); setLearningResourceTitle(""); setLearningResourceSubject(""); setLearningResourceLevel("Beginner"); setLearningResourceDescription(""); setLearningResourceUrl(""); setLearningResourceFile(null); setLearningResourceMessage(""); }}>Cancel edit</button>}</div>
            </form>
          </div>}
          <div className="workspace-card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <label className="full-label">Search resources<input type="search" value={learningResourceSearch} onChange={(e) => setLearningResourceSearch(e.target.value)} placeholder="Search title, topic or description" /></label>
              <label className="full-label">Choose learning level<select value={learningResourceLevelFilter} onChange={(e) => setLearningResourceLevelFilter(e.target.value)}><option value="all">All levels — Beginner, Intermediate & Advanced</option><option value="Beginner">Beginner</option><option value="Intermediate">Intermediate</option><option value="Advanced">Advanced</option></select></label>
              <label className="full-label">Filter by course<select value={learningResourceCourseFilter} onChange={(e) => setLearningResourceCourseFilter(e.target.value)}><option value="all">All courses</option>{learningResourceCourses.map((course) => <option key={course}>{course}</option>)}</select></label>
            </div>
          </div>
          {learningResourcesLoading ? <p className="demo-note">Loading learning resources...</p> : null}
          {!learningResourcesLoading && learningResources.filter((item) => (learningResourceLevelFilter === "all" || (item.level || "Beginner") === learningResourceLevelFilter) && (learningResourceCourseFilter === "all" || item.course === learningResourceCourseFilter) && `${item.title} ${item.subject || ""} ${item.description || ""} ${item.course || ""} ${item.level || "Beginner"}`.toLowerCase().includes(learningResourceSearch.toLowerCase())).length === 0 && <div className="workspace-card"><h3>No resources found</h3><p className="demo-note">Try another search or course filter. Published materials from faculty will appear here.</p></div>}
          <div className="dashboard-course-grid">
            {learningResources.filter((item) => (learningResourceLevelFilter === "all" || (item.level || "Beginner") === learningResourceLevelFilter) && (learningResourceCourseFilter === "all" || item.course === learningResourceCourseFilter) && `${item.title} ${item.subject || ""} ${item.description || ""} ${item.course || ""} ${item.level || "Beginner"}`.toLowerCase().includes(learningResourceSearch.toLowerCase())).map((item) => {
              const canManage = accountRole === "admin" || (accountRole === "faculty" && item.createdBy === auth.currentUser?.uid);
              return <article className="dashboard-course-card" key={item.id}>
                <div className="course-card-meta"><span>{item.course}</span><span>{item.level || "Beginner"}</span><span>{item.resourceType === "video" ? "Video" : "Document"}</span></div>
                <h3>{item.resourceType === "video" ? "▶️ " : "📄 "}{item.title}</h3>
                {item.subject && <p><strong>Topic:</strong> {item.subject}</p>}
                <p>{item.description || "Course learning resource shared by faculty."}</p>
                {canManage && <p className="demo-note">Status: {(item.status || "draft").toUpperCase()}</p>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {item.resourceType === "video" && item.url ? <a className="primary-action" href={item.url} target="_blank" rel="noreferrer">Open video</a> : item.file?.path ? <button type="button" className="primary-action" onClick={() => downloadLearningResource(item)}>Download file</button> : null}
                  {canManage && <><button type="button" className="secondary-action" onClick={() => editLearningResource(item)}>Edit</button><button type="button" className="secondary-action" onClick={() => deleteLearningResource(item)}>Delete</button></>}
                </div>
              </article>;
            })}
          </div>
          <p className="demo-note">Students can choose All levels, Beginner, Intermediate or Advanced to find any published notes shared by faculty. Files are stored in Firebase Storage and resource details in the learningResources Firestore collection.</p>
        </section>

        {/* ADMIN DASHBOARD — visible only to the admin role */}
        {accountRole === "admin" && (
          <section className="dashboard-section" id="admin-panel">
            <div className="dashboard-section-heading">
              <div>
                <span>SECURITY & ACCOUNT CONTROL</span>
                <h2>Admin Dashboard</h2>
                <p className="section-description">Manage Student and Faculty roles. Admin privileges are deliberately not assignable from this client dashboard.</p>
              </div>
              <span className="settings-status" style={{ background: "#e8f8f4", color: "#087b68" }}>Verified admin view</span>
            </div>
            <div className="dashboard-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
              <div className="dashboard-stat-card"><span>👥</span><p>Total accounts</p><h2>{adminUsers.length}</h2></div>
              <div className="dashboard-stat-card"><span>🎓</span><p>Faculty</p><h2>{adminUsers.filter((item) => item.role === "faculty").length}</h2></div>
              <div className="dashboard-stat-card"><span>📘</span><p>Students</p><h2>{adminUsers.filter((item) => !item.role || item.role === "student").length}</h2></div>
              <div className="dashboard-stat-card"><span>🛡️</span><p>Admins</p><h2>{adminUsers.filter((item) => item.role === "admin").length}</h2></div>
            </div>
            <div className="workspace-card" style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div><h3 style={{ margin: 0, color: "#18334f" }}>Account role management</h3><p className="demo-note">Search registered profiles and assign Student or Faculty access. Changes are enforced by Firestore rules.</p></div>
                <button type="button" className="secondary-action" onClick={() => { setAdminUsersError(""); setAdminUsersMessage(""); setAdminUsersLoading(true); getDocs(collection(db, "users")).then((snapshot) => setAdminUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))).catch((err) => { console.error(err); setAdminUsersError("Could not refresh the user list. Check Firestore permissions."); }).finally(() => setAdminUsersLoading(false)); }}>Refresh users</button>
              </div>
              <label className="full-label" style={{ display: "block", margin: "14px 0" }}>Search by name, email or UID<input type="search" value={adminUserSearch} onChange={(event) => setAdminUserSearch(event.target.value)} placeholder="Search accounts..." /></label>
              {adminUsersLoading && <p className="demo-note">Loading accounts...</p>}
              {adminUsersError && <p className="auth-error" role="alert">{adminUsersError}</p>}
              {adminUsersMessage && <p className="success-message" role="status">{adminUsersMessage}</p>}
              {!adminUsersLoading && !adminUsersError && adminUsers.filter((item) => `${item.name || ""} ${item.email || ""} ${item.id}`.toLowerCase().includes(adminUserSearch.toLowerCase())).length === 0 && <p className="demo-note">No matching user profiles found.</p>}
              <div style={{ display: "grid", gap: 10 }}>
                {adminUsers.filter((item) => `${item.name || ""} ${item.email || ""} ${item.id}`.toLowerCase().includes(adminUserSearch.toLowerCase())).map((item) => {
                  const role = String(item.role || "student").toLowerCase();
                  const protectedAccount = role === "admin" || item.id === auth.currentUser?.uid;
                  return <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: 13, border: "1px solid #e1e8ef", borderRadius: 10 }}>
                    <div style={{ minWidth: 180, flex: "1 1 240px" }}><strong style={{ color: "#18334f" }}>{item.name || "Unnamed user"}</strong><div className="demo-note">{item.email || "No email in profile"}</div><div className="demo-note" style={{ fontSize: 10 }}>UID: {item.id}</div></div>
                    <span className="settings-status" style={{ background: role === "admin" ? "#e8f0ff" : role === "faculty" ? "#e8f8f4" : "#f1f5f9", color: role === "admin" ? "#254b8a" : role === "faculty" ? "#087b68" : "#475569" }}>{role.toUpperCase()}</span>
                    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                      <select aria-label={`Change role for ${item.name || item.email || item.id}`} value={role} disabled={protectedAccount || adminRoleSavingId === item.id} onChange={(event) => updateManagedUserRole(item, event.target.value)} style={{ padding: 9, border: "1px solid #dce5ed", borderRadius: 8, background: protectedAccount ? "#f1f5f9" : "white" }}>
                        <option value="student">Student</option><option value="faculty">Faculty</option>{role === "admin" && <option value="admin">Admin</option>}
                      </select>
                      {adminRoleSavingId === item.id && <span className="demo-note">Saving...</span>}
                    </div>
                  </div>;
                })}
              </div>
              <p className="demo-note" style={{ marginTop: 16 }}>Security note: this dashboard cannot create or promote Admin accounts. Bootstrap the first admin and grant any additional admin role through a trusted Firebase Admin SDK environment or the Firebase Console. Never expose service-account credentials in frontend code.</p>
            </div>
          </section>
        )}

        {/* FACULTY / ADMIN PANEL */}
        {["faculty", "admin"].includes(accountRole) && (
          <section className="dashboard-section" id="faculty-panel">
            <div className="dashboard-section-heading">
              <div>
                <span>COURSE MANAGEMENT</span>
                <h2>Faculty / Admin Panel</h2>
                <p className="section-description">Create, edit and publish lessons, study resources and announcements for the six SmartLearn courses.</p>
              </div>
              <span className="settings-status">{accountRole === "admin" ? "Admin access" : "Faculty access"}</span>
            </div>

            <div className="workspace-card" id="assignment-management" style={{ padding: 22, marginBottom: 22 }}>
              <h3 style={{ color: "#18334f", marginTop: 0 }}>Assignment Management</h3>
              <p className="demo-note">Create and publish assignments for students. You can review submissions and provide marks and feedback from the Assignments section.</p>
              <form onSubmit={saveAssignment} style={{ display: "grid", gap: 12 }}>
                <label className="full-label">Assignment title<input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="e.g. Python loops practice" required /></label>
                <label className="full-label">Course<select value={assignmentCourse} onChange={(event) => setAssignmentCourse(event.target.value)}>{["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"].map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="full-label">Instructions<textarea rows={4} value={assignmentDescription} onChange={(event) => setAssignmentDescription(event.target.value)} placeholder="Explain what students need to complete..." required /></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}><label className="full-label">Due date<input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} required /></label><label className="full-label">Total marks<input type="number" min="1" max="1000" value={assignmentMarks} onChange={(event) => setAssignmentMarks(event.target.value)} required /></label></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary-action" type="submit" disabled={assignmentSaving}>{assignmentSaving ? "Saving..." : editingAssignmentId ? "Update Assignment" : "Publish Assignment"}</button>{editingAssignmentId && <button className="secondary-action" type="button" onClick={() => { setEditingAssignmentId(null); setAssignmentTitle(""); setAssignmentDescription(""); setAssignmentMarks("100"); setAssignmentMessage("Edit cancelled."); }}>Cancel Edit</button>}</div>
              </form>
              {assignmentMessage && <p className="success-message">{assignmentMessage}</p>}{assignmentError && <p className="auth-error">{assignmentError}</p>}
              <h4 style={{ color: "#18334f", marginTop: 22 }}>Manage published assignments</h4>
              {assignments.filter((item) => item.createdBy === auth.currentUser?.uid || accountRole === "admin").map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", border: "1px solid #e1e8ef", borderRadius: 10, padding: 12, marginTop: 8 }}><div><strong>{item.title}</strong><p className="demo-note">{item.course} · Due {item.dueDate}</p></div><div style={{ display: "flex", gap: 7 }}><button type="button" className="secondary-action" onClick={() => editAssignment(item)}>Edit</button><button type="button" className="secondary-action" onClick={() => deleteAssignment(item.id)}>Delete</button><button type="button" className="secondary-action" onClick={() => { goTo("assignments"); loadAssignmentSubmissions(item.id); }}>Submissions</button></div></div>)}
            </div>

            <div className="workspace-card" style={{ padding: 22, marginBottom: 22 }}>
              <form onSubmit={saveFacultyResource} style={{ display: "grid", gap: 14 }}>
                <label>Content title
                  <input value={facultyTitle} onChange={(event) => setFacultyTitle(event.target.value)} placeholder="e.g. Introduction to Python Variables" required />
                </label>
                <label>Course
                  <select value={facultyCourse} onChange={(event) => setFacultyCourse(event.target.value)}>
                    {(["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"]).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label>Content type
                  <select value={facultyType} onChange={(event) => setFacultyType(event.target.value)}>
                    <option>Lesson</option><option>Study Material</option><option>Announcement</option><option>Assignment</option>
                  </select>
                </label>
                <label>Short description
                  <input value={facultyDescription} onChange={(event) => setFacultyDescription(event.target.value)} placeholder="Briefly describe this content" />
                </label>
                <label>Content
                  <textarea value={facultyContent} onChange={(event) => setFacultyContent(event.target.value)} rows={8} placeholder="Write lesson content, instructions or an announcement..." required />
                </label>
                <label>Publication status
                  <select value={facultyStatus} onChange={(event) => setFacultyStatus(event.target.value)}><option>Draft</option><option>Published</option></select>
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="primary-action" type="submit" disabled={facultySaving}>{facultySaving ? "Saving..." : facultyEditingId ? "Update Content" : facultyStatus === "Published" ? "Publish Content" : "Save Draft"}</button>
                  {facultyEditingId && <button type="button" onClick={() => { setFacultyEditingId(null); setFacultyTitle(""); setFacultyDescription(""); setFacultyContent(""); setFacultyStatus("Draft"); setFacultyMessage("Edit cancelled."); }} className="secondary-action">Cancel Edit</button>}
                </div>
              </form>
              {facultyMessage && <p className="success-message">{facultyMessage}</p>}
              {facultyError && <p className="auth-error">{facultyError}</p>}
            </div>

            <div className="dashboard-section-heading"><div><h3>Managed course content ({facultyResources.length})</h3></div></div>
            {facultyLoading ? <p className="demo-note">Loading course content...</p> : null}
            {!facultyLoading && facultyResources.length === 0 && <p className="demo-note">No course content yet. Create your first lesson, resource or announcement above.</p>}
            <div className="dashboard-course-grid">
              {facultyResources.map((item) => (
                <article className="dashboard-course-card" key={item.id}>
                  <div className="course-card-meta"><span>{item.course}</span><span>{item.type}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.description || (item.content || "").slice(0, 150)}</p>
                  <p className="demo-note">Status: {(item.status || "draft").toUpperCase()}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => editFacultyResource(item)}>Edit</button>
                    <button type="button" onClick={() => deleteFacultyResource(item.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
            <p className="demo-note">Access is controlled by the role field in your Firestore user profile. Do not let users assign themselves faculty/admin roles. Published content is stored in the shared courseContent collection; configure the matching Firestore rules before using it with student accounts.</p>
          </section>
        )}

        {/* STUDENT FEEDBACK & COURSE RATINGS */}
        <section className="dashboard-section" id="course-feedback">
          <div className="dashboard-section-heading">
            <div><span>HELP US IMPROVE</span><h2>Student Feedback & Course Ratings</h2><p className="section-description">Rate each course from 1 to 5 stars and share what is working well or what could improve. You can edit or delete your own feedback at any time.</p></div>
          </div>
          {feedbackError && <p className="auth-error" role="alert">{feedbackError}</p>}
          {feedbackMessage && <p className="success-message" role="status">{feedbackMessage}</p>}
          {!["faculty", "admin"].includes(accountRole) && <form className="workspace-card" onSubmit={saveCourseFeedback} style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>Share your course feedback</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
              <label className="full-label">Course<select value={feedbackCourse} onChange={(e) => { const nextCourse = e.target.value; const ownReview = courseFeedback.find((item) => item.studentId === auth.currentUser?.uid && item.course === nextCourse); setFeedbackCourse(nextCourse); setFeedbackRating(String(ownReview?.rating || 5)); setFeedbackComment(ownReview?.comment || ""); }}>{["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"].map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="full-label">Your rating<select value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}><option value="5">★★★★★ — Excellent</option><option value="4">★★★★☆ — Very good</option><option value="3">★★★☆☆ — Good</option><option value="2">★★☆☆☆ — Needs improvement</option><option value="1">★☆☆☆☆ — Poor</option></select></label>
            </div>
            <label className="full-label" style={{ display: "grid", gap: 7, marginTop: 14 }}>Your comments<textarea rows={4} maxLength={2000} value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} placeholder="Tell us about the lessons, explanations, exercises or areas we can improve..." required /></label>
            <button className="primary-action" type="submit" disabled={feedbackSaving} style={{ marginTop: 14 }}>{feedbackSaving ? "Saving..." : (courseFeedback.some((item) => item.studentId === auth.currentUser?.uid && item.course === feedbackCourse) ? "Update My Feedback" : "Submit Feedback")}</button>
          </form>}
          <div className="workspace-card" style={{ padding: 20 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>Course rating overview</h3>
            {feedbackLoading ? <p className="demo-note">Loading course ratings...</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              {["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"].map((course) => {
                const reviews = courseFeedback.filter((item) => item.course === course);
                const average = reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length : 0;
                return <div key={course} style={{ border: "1px solid #e3eaf0", borderRadius: 12, padding: 14 }}><strong style={{ color: "#18334f" }}>{course}</strong><div style={{ color: "#d69e20", fontSize: 19, marginTop: 5 }}>{reviews.length ? `${average.toFixed(1)} / 5 ★` : "Not rated yet"}</div><small style={{ color: "#64748b" }}>{reviews.length} review(s)</small></div>;
              })}
            </div>}
          </div>
          <div className="workspace-card" style={{ padding: 20, marginTop: 18 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>{["faculty", "admin"].includes(accountRole) ? "Student feedback received" : "My submitted feedback"}</h3>
            {feedbackLoading ? <p className="demo-note">Loading feedback...</p> : (() => {
              const visibleFeedback = ["faculty", "admin"].includes(accountRole) ? courseFeedback : courseFeedback.filter((item) => item.studentId === auth.currentUser?.uid);
              return !visibleFeedback.length ? <p className="demo-note">No feedback has been submitted yet.</p> : <div style={{ display: "grid", gap: 12 }}>
                {visibleFeedback.map((item) => <article key={item.id} style={{ border: "1px solid #e3eaf0", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong style={{ color: "#18334f" }}>{item.course}</strong><span style={{ color: "#d69e20", fontWeight: 700 }}>{"★".repeat(Math.max(0, Math.min(5, Number(item.rating) || 0)))}{"☆".repeat(5 - Math.max(0, Math.min(5, Number(item.rating) || 0)))}</span></div>
                  {["faculty", "admin"].includes(accountRole) && <small style={{ color: "#64748b" }}>Student: {item.studentName || "Student"}</small>}
                  <p style={{ color: "#526174", whiteSpace: "pre-wrap", margin: "8px 0" }}>{item.comment}</p>
                  <small style={{ color: "#64748b" }}>Last updated: {item.updatedAt?.toDate ? item.updatedAt.toDate().toLocaleDateString() : "Just now"}</small>
                  {item.studentId === auth.currentUser?.uid && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" className="secondary-action" onClick={() => editCourseFeedback(item)}>Edit</button><button type="button" className="secondary-action" style={{ color: "#b42318" }} onClick={() => deleteCourseFeedback(item)}>Delete</button></div>}
                </article>)}
              </div>;
            })()}
          </div>
          <p className="demo-note" style={{ marginTop: 12 }}>Feedback is stored in the Firestore <code>courseFeedback</code> collection. Students can edit or delete only their own review; faculty and admins can review submitted feedback.</p>
        </section>

        {/* ASSIGNMENT MANAGEMENT & SUBMISSIONS */}
        <section className="dashboard-section" id="assignments">
          <div className="dashboard-section-heading"><div><span>COURSEWORK</span><h2>Assignments</h2><p className="section-description">View course assignments, submit your work and track faculty feedback.</p></div></div>
          {assignmentError && <p className="auth-error" role="alert">{assignmentError}</p>}
          {assignmentMessage && <p className="success-message" role="status">{assignmentMessage}</p>}
          {assignmentsLoading ? <div className="workspace-card"><p className="demo-note">Loading assignments...</p></div> : assignments.filter((item) => item.status === "published").length === 0 ? <div className="workspace-card" style={{ textAlign: "center", padding: 30 }}><div style={{ fontSize: 36 }}>📋</div><h3 style={{ color: "#18334f" }}>No assignments available</h3><p className="demo-note">Published course assignments will appear here.</p></div> : <div style={{ display: "grid", gap: 14 }}>
            {assignments.filter((item) => item.status === "published").map((assignment) => {
              const submission = assignmentSubmissions[assignment.id];
              const overdue = assignment.dueDate && assignment.dueDate < new Date().toLocaleDateString("en-CA") && !submission;
              return <article className="workspace-card" key={assignment.id} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><span style={{ color: "#139b91", fontSize: 12, fontWeight: 700 }}>{assignment.course}</span><h3 style={{ color: "#18334f", margin: "7px 0" }}>{assignment.title}</h3></div><span style={{ background: submission?.status === "graded" ? "#e8f7ef" : submission ? "#eaf3ff" : overdue ? "#fff1f0" : "#fff6e8", color: submission?.status === "graded" ? "#167345" : submission ? "#245a9b" : overdue ? "#b42318" : "#946200", padding: "7px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{submission?.status === "graded" ? "GRADED" : submission ? "SUBMITTED" : overdue ? "OVERDUE" : "PENDING"}</span></div>
                <p style={{ color: "#526174", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{assignment.description}</p>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "#64748b", fontSize: 13, marginBottom: 12 }}><span>📅 Due: {assignment.dueDate || "Not set"}</span><span>🏅 Total marks: {assignment.totalMarks || 100}</span></div>
                {! ["faculty", "admin"].includes(accountRole) && <>
                  <label className="full-label">Your answer<textarea rows={5} value={submissionDrafts[assignment.id] ?? submission?.answer ?? ""} onChange={(event) => setSubmissionDrafts((current) => ({ ...current, [assignment.id]: event.target.value }))} placeholder="Write your assignment answer here..." disabled={submission?.status === "graded"} /></label>
                  <label className="full-label">Attach a document (optional)<input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={(event) => setSubmissionFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0] || null }))} disabled={submission?.status === "graded"} />{submissionFiles[assignment.id]?.name && <span className="demo-note">Selected: {submissionFiles[assignment.id].name}</span>}</label>
                  {submission?.attachment?.url && <p className="demo-note">Previously submitted file: <a href={submission.attachment.url} target="_blank" rel="noreferrer">{submission.attachment.name || "Open attachment"}</a></p>}
                  <button type="button" className="primary-action" onClick={() => submitAssignment(assignment)} disabled={submissionSavingId === assignment.id || submission?.status === "graded"}>{submissionSavingId === assignment.id ? "Submitting..." : submission ? "Update Submission" : "Submit Assignment"}</button>
                  {submission?.status === "graded" && <div style={{ background: "#f0fbf7", borderRadius: 10, padding: 14, marginTop: 12 }}><strong style={{ color: "#167345" }}>Grade: {submission.score}/{assignment.totalMarks || 100}</strong><p style={{ marginBottom: 0, color: "#526174" }}>Faculty feedback: {submission.feedback || "No feedback provided."}</p></div>}
                  {submission?.status === "submitted" && <p className="demo-note">Your work has been submitted and is waiting for faculty review.</p>}
                </>}
                {["faculty", "admin"].includes(accountRole) && <>
                  <button type="button" className="secondary-action" onClick={() => loadAssignmentSubmissions(assignment.id)}>View Student Submissions</button>
                  {Array.isArray(assignmentSubmissions[`all_${assignment.id}`]) && <div style={{ display: "grid", gap: 12, marginTop: 12 }}><strong style={{ color: "#18334f" }}>Submissions ({assignmentSubmissions[`all_${assignment.id}`].length})</strong>{assignmentSubmissions[`all_${assignment.id}`].map((item) => { const key = `${assignment.id}_${item.id}`; const draft = gradingDrafts[key] || { score: String(item.score ?? ""), feedback: item.feedback || "" }; return <div key={item.id} style={{ border: "1px solid #e1e8ef", borderRadius: 10, padding: 14 }}><strong>{item.studentName || item.studentEmail || "Student"}</strong><p className="demo-note">{item.studentEmail} · {item.status || "submitted"}</p><p style={{ whiteSpace: "pre-wrap", color: "#526174" }}>{item.answer}</p>{item.attachment?.url && <p className="demo-note">Attachment: <a href={item.attachment.url} target="_blank" rel="noreferrer">{item.attachment.name || "Download submitted file"}</a></p>}<label className="full-label">Marks<input type="number" min="0" max={assignment.totalMarks || 100} value={draft.score} onChange={(event) => setGradingDrafts((current) => ({ ...current, [key]: { ...draft, score: event.target.value } }))} /></label><label className="full-label">Feedback<textarea rows={2} value={draft.feedback} onChange={(event) => setGradingDrafts((current) => ({ ...current, [key]: { ...draft, feedback: event.target.value } }))} /></label><button type="button" className="primary-action" onClick={() => gradeAssignment(assignment, item)}>Save Grade & Feedback</button></div>; })}</div>}
                </>}
              </article>;
            })}
          </div>}
          <p className="demo-note" style={{ marginTop: 14 }}>Assignments are stored in the shared Firestore <code>assignments</code> collection. Each student's submission is stored in that assignment's <code>submissions</code> subcollection.</p>
        </section>

        {/* FEATURE 18 — STUDY GROUPS & PEER COLLABORATION */}
        <section className="dashboard-section" id="study-groups">
          <div className="dashboard-section-heading">
            <div>
              <span>FEATURE 29 · LEARN TOGETHER</span>
              <h2>👥 AI Group Study & Collaboration Hub</h2>
              <p className="section-description">Create or join study groups, invite classmates with a code, chat, set shared goals and manage collaborative tasks.</p>
            </div>
          </div>

          <div className="workspace-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>Create a Study Group</h3>
            <form onSubmit={createStudyGroup} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, alignItems: "end" }}>
              <label className="full-label" style={{ margin: 0 }}>Group name
                <input value={studyGroupTitle} onChange={(e) => setStudyGroupTitle(e.target.value)} placeholder="e.g. Python Weekend Learners" maxLength={80} required />
              </label>
              <label className="full-label" style={{ margin: 0 }}>Course
                <select value={studyGroupCourse} onChange={(e) => setStudyGroupCourse(e.target.value)}>
                  {["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management", "General Study"].map((course) => <option key={course}>{course}</option>)}
                </select>
              </label>
              <label className="full-label" style={{ margin: 0, gridColumn: "1 / -1" }}>Group description
                <textarea value={studyGroupDescription} onChange={(e) => setStudyGroupDescription(e.target.value)} placeholder="What will your group learn or practise together?" rows={3} maxLength={500} required />
              </label>
              <button type="submit" disabled={studyGroupSaving} className="primary-button">{studyGroupSaving ? "Creating..." : "＋ Create Group"}</button>
            </form>
            <form onSubmit={joinStudyGroupByCode} style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "end", borderTop: "1px solid #e6edf3", marginTop: 16, paddingTop: 15 }}>
              <label className="full-label" style={{ margin: 0, flex: "1 1 220px" }}>Join with group code
                <input value={studyGroupJoinCode} onChange={(e) => setStudyGroupJoinCode(e.target.value.toUpperCase())} placeholder="Enter 6-character code" maxLength={6} />
              </label>
              <button type="submit" className="secondary-button">Join by Code</button>
            </form>
            {studyGroupMessage && <p role="status" style={{ color: "#167345", marginBottom: 0 }}>{studyGroupMessage}</p>}
            {studyGroupError && <p role="alert" style={{ color: "#c0392b", marginBottom: 0 }}>{studyGroupError}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 18, alignItems: "start" }}>
            <div className="workspace-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <h3 style={{ color: "#18334f", margin: 0 }}>Available Study Groups</h3>
                <button type="button" onClick={loadStudyGroups} className="secondary-button">↻ Refresh</button>
              </div>
              {studyGroupsLoading ? <p>Loading study groups...</p> : studyGroups.length === 0 ? (
                <p>No study groups yet. Create the first group for your course.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {studyGroups.map((group) => {
                    const isMember = !!auth.currentUser && (group.memberIds || []).includes(auth.currentUser.uid);
                    return <article key={group.id} style={{ border: "1px solid #e3eaf1", borderRadius: 12, padding: 14, background: selectedStudyGroup?.id === group.id ? "#f0f8fa" : "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <div>
                          <h4 style={{ margin: "0 0 5px", color: "#18334f" }}>{group.title}</h4>
                          <span style={{ color: "#139b91", fontSize: 12, fontWeight: 700 }}>{group.course}</span>
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>👥 {(group.memberIds || []).length} members</span>
                      </div>
                      <p style={{ color: "#526477", margin: "9px 0", fontSize: 14 }}>{group.description}</p>
                      <p style={{ color: "#718096", fontSize: 12, margin: "0 0 10px" }}>Created by {group.createdByName || "Student"} · Code: <strong style={{ color: "#176b68", letterSpacing: 1 }}>{group.groupCode || "Legacy group"}</strong></p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isMember ? <button type="button" className="primary-button" onClick={() => setSelectedStudyGroup(group)}>Open Group</button> : <button type="button" className="primary-button" onClick={() => joinStudyGroup(group)}>Join Group</button>}
                        {isMember && group.createdBy !== auth.currentUser?.uid && <button type="button" className="secondary-button" onClick={() => leaveStudyGroup(group)}>Leave</button>}
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </div>

            <div className="workspace-card" style={{ padding: 20, minHeight: 300 }}>
              <h3 style={{ color: "#18334f", marginTop: 0 }}>Group Discussion</h3>
              {!selectedStudyGroup ? <p style={{ color: "#64748b" }}>Join a group or open one you created to view its members and share messages.</p> : <>
                <h4 style={{ margin: "0 0 5px", color: "#18334f" }}>{selectedStudyGroup.title}</h4>
                <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>{selectedStudyGroup.course} · {(selectedStudyGroup.memberIds || []).length} members · Invite code: <strong style={{ color: "#087f8c", letterSpacing: 1 }}>{selectedStudyGroup.groupCode || "Not available for this older group"}</strong></p>
                <div style={{ background: "#f5f8fb", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <strong style={{ color: "#18334f", fontSize: 13 }}>Group members</strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                    {(selectedStudyGroup.memberIds || []).map((memberId) => <span key={memberId} style={{ background: "#e6f3f3", color: "#176b68", borderRadius: 20, padding: "5px 9px", fontSize: 12 }}>{selectedStudyGroup.memberNames?.[memberId] || "Student"}{memberId === selectedStudyGroup.createdBy ? " · Owner" : ""}</span>)}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 9, maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
                  {studyGroupMessagesLoading ? <p>Loading messages...</p> : studyGroupMessages.length === 0 ? <p style={{ color: "#718096", fontSize: 13 }}>No messages yet. Start the conversation!</p> : studyGroupMessages.map((message) => <div key={message.id} style={{ background: message.authorId === auth.currentUser?.uid ? "#eaf7f5" : "#f4f6f9", borderRadius: 10, padding: 10 }}>
                    <strong style={{ color: "#18334f", fontSize: 12 }}>{message.authorName || "Student"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</p>
                  </div>)}
                </div>
                <form onSubmit={postStudyGroupMessage} style={{ display: "flex", gap: 8, alignItems: "end" }}>
                  <textarea value={studyGroupMessageDraft} onChange={(e) => setStudyGroupMessageDraft(e.target.value)} placeholder="Share a question or study note..." rows={2} maxLength={1000} style={{ flex: 1, minWidth: 0 }} required />
                  <button type="submit" className="primary-button" disabled={studyGroupMessageSaving}>{studyGroupMessageSaving ? "Sending..." : "Send"}</button>
                </form>
                <div style={{ borderTop: "1px solid #e5ebf2", marginTop: 18, paddingTop: 16, display: "grid", gap: 16 }}>
                  <div>
                    <h4 style={{ color: "#18334f", margin: "0 0 9px" }}>🎯 Shared study goals</h4>
                    <form onSubmit={addStudyGroupGoal} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input value={studyGroupGoalDraft} onChange={(e) => setStudyGroupGoalDraft(e.target.value)} placeholder="e.g. Finish Python loops this week" maxLength={140} style={{ flex: "1 1 180px" }} required /><button className="primary-button" type="submit">Add Goal</button></form>
                    {(selectedStudyGroup.goals || []).length === 0 ? <p className="demo-note">No shared goals yet.</p> : (selectedStudyGroup.goals || []).map((goal) => <label key={goal.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", color: "#334155" }}><input type="checkbox" checked={!!goal.done} onChange={() => toggleStudyGroupGoal(goal.id)} /><span style={{ textDecoration: goal.done ? "line-through" : "none", opacity: goal.done ? .65 : 1 }}>{goal.title}</span></label>)}
                  </div>
                  <div>
                    <h4 style={{ color: "#18334f", margin: "0 0 9px" }}>📋 Group task board</h4>
                    <form onSubmit={addStudyGroupTask} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}><input value={studyGroupTaskDraft} onChange={(e) => setStudyGroupTaskDraft(e.target.value)} placeholder="Task to complete" maxLength={140} required /><select value={studyGroupTaskAssignee} onChange={(e) => setStudyGroupTaskAssignee(e.target.value)}><option value="">Assign to anyone</option>{(selectedStudyGroup.memberIds || []).map((id) => <option key={id} value={id}>{selectedStudyGroup.memberNames?.[id] || "Student"}</option>)}</select><button className="primary-button" type="submit">Add Task</button></form>
                    {(selectedStudyGroup.tasks || []).length === 0 ? <p className="demo-note">No tasks assigned yet.</p> : <div style={{ display: "grid", gap: 7, marginTop: 9 }}>{(selectedStudyGroup.tasks || []).map((task) => <label key={task.id} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #e5ebf2", borderRadius: 8, padding: 9 }}><input type="checkbox" checked={!!task.done} onChange={() => toggleStudyGroupTask(task.id)} /><span style={{ flex: 1, textDecoration: task.done ? "line-through" : "none", color: "#334155" }}>{task.title}<small style={{ display: "block", color: "#718096" }}>Assigned: {task.assigneeName || "Anyone"}</small></span><span style={{ fontSize: 11, color: task.done ? "#167345" : "#64748b" }}>{task.done ? "Done" : "Open"}</span></label>)}</div>}
                  </div>
                  <div style={{ background: "#f5f8fb", borderRadius: 9, padding: 11 }}><strong style={{ color: "#18334f" }}>Group progress</strong><p className="demo-note" style={{ margin: "5px 0 0" }}>{(selectedStudyGroup.goals || []).filter((goal) => goal.done).length}/{(selectedStudyGroup.goals || []).length} goals completed · {(selectedStudyGroup.tasks || []).filter((task) => task.done).length}/{(selectedStudyGroup.tasks || []).length} tasks completed</p></div>
                </div>
              </>}
            </div>
          </div>
        </section>

        {/* FEATURE 19 — PEER LEARNING CHALLENGES */}
        <section className="dashboard-section" id="peer-challenges">
          <div className="dashboard-section-heading">
            <div>
              <span>PRACTISE • IMPROVE • ACHIEVE</span>
              <h2>Peer Learning Challenges</h2>
              <p className="section-description">Take short course-based challenges, get instant feedback, save your scores and compare your best results with fellow learners.</p>
            </div>
          </div>

          <div className="workspace-card" style={{ padding: 20, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><h3 style={{ color: "#18334f", margin: "0 0 5px" }}>Choose your challenge</h3><p className="demo-note" style={{ margin: 0 }}>Each correct answer earns equal points. Your best score appears on the leaderboard.</p></div>
              <select aria-label="Select a peer learning challenge" value={selectedPeerChallengeId} onChange={(event) => choosePeerChallenge(event.target.value)} style={{ minWidth: 230 }}>
                {peerLearningChallenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
              <span style={{ background: "#eaf7f5", color: "#087f78", borderRadius: 20, padding: "6px 11px", fontSize: 12, fontWeight: 700 }}>{selectedPeerChallenge.course}</span>
              <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "6px 11px", fontSize: 12, fontWeight: 700 }}>{selectedPeerChallenge.level}</span>
              <span style={{ background: "#fff7e8", color: "#946200", borderRadius: 20, padding: "6px 11px", fontSize: 12, fontWeight: 700 }}>{selectedPeerChallenge.points} points</span>
            </div>
            <p style={{ color: "#526174", marginTop: 0 }}>{selectedPeerChallenge.description}</p>
            {peerChallengeError && <p className="auth-error" role="alert">{peerChallengeError}</p>}
            {peerChallengeMessage && <p className="success-message" role="status">{peerChallengeMessage}</p>}
            <form onSubmit={submitPeerChallenge}>
              <div style={{ display: "grid", gap: 14 }}>
                {selectedPeerChallenge.questions.map((question, index) => (
                  <fieldset key={question.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, minWidth: 0 }}>
                    <legend style={{ padding: "0 7px", color: "#18334f", fontWeight: 700 }}>Question {index + 1}</legend>
                    <p style={{ color: "#334155", fontWeight: 600, marginTop: 2 }}>{question.prompt}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 9 }}>
                      {question.options.map((option, optionIndex) => {
                        const isChosen = Number(peerChallengeAnswers[question.id]) === optionIndex;
                        const isCorrect = peerChallengeResult && optionIndex === question.answer;
                        const isWrongChosen = peerChallengeResult && isChosen && optionIndex !== question.answer;
                        return <label key={optionIndex} style={{ display: "flex", alignItems: "center", gap: 9, padding: 11, borderRadius: 9, border: `1px solid ${isCorrect ? "#20a36b" : isWrongChosen ? "#d94848" : isChosen ? "#139b91" : "#e2e8f0"}`, background: isCorrect ? "#ecfdf3" : isWrongChosen ? "#fff1f1" : isChosen ? "#effaf9" : "#fff", cursor: peerChallengeResult ? "default" : "pointer" }}>
                          <input type="radio" name={question.id} value={optionIndex} checked={isChosen} disabled={!!peerChallengeResult} onChange={() => setPeerChallengeAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />
                          <span style={{ color: "#334155", fontSize: 14 }}>{option}</span>
                        </label>;
                      })}
                    </div>
                    {peerChallengeResult && <p style={{ color: "#167345", fontSize: 13, marginBottom: 0 }}><strong>{question.answer === Number(peerChallengeAnswers[question.id]) ? "Correct! " : "Explanation: "}</strong>{question.explanation}</p>}
                  </fieldset>
                ))}
              </div>
              {peerChallengeResult ? (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#effaf6", border: "1px solid #b9e8d2" }}>
                  <h3 style={{ color: "#176b4a", margin: "0 0 5px" }}>Challenge completed: {peerChallengeResult.score}/{peerChallengeResult.totalPoints} points</h3>
                  <p style={{ color: "#356653", margin: 0 }}>You answered {peerChallengeResult.correctCount} out of {peerChallengeResult.questionCount} questions correctly.</p>
                  <button type="button" className="secondary-action" style={{ marginTop: 12 }} onClick={() => { setPeerChallengeAnswers({}); setPeerChallengeResult(null); setPeerChallengeMessage(""); setPeerChallengeError(""); }}>Try again</button>
                </div>
              ) : <button type="submit" className="primary-action" style={{ marginTop: 16 }} disabled={peerChallengeSaving}>{peerChallengeSaving ? "Saving score..." : "Submit Challenge"}</button>}
            </form>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 18, alignItems: "start" }}>
            <div className="workspace-card" style={{ padding: 20 }}>
              <h3 style={{ color: "#18334f", marginTop: 0 }}>🏆 Leaderboard</h3>
              <p className="demo-note">Top 10 best scores per learner and challenge.</p>
              {peerChallengeLoading ? <p className="demo-note">Loading leaderboard...</p> : peerLeaderboard.length === 0 ? <p className="demo-note">No scores yet. Complete a challenge to be the first on the leaderboard.</p> : <div style={{ display: "grid", gap: 9 }}>
                {peerLeaderboard.map((item, index) => <div key={`${item.challengeId}-${item.studentId}-${index}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 11, borderRadius: 10, background: index === 0 ? "#fff8e8" : "#f7fafc", border: "1px solid #e7edf3" }}>
                  <div style={{ minWidth: 0 }}><strong style={{ color: "#18334f" }}>{index + 1}. {item.studentName || "Learner"}</strong><div className="demo-note" style={{ marginTop: 3 }}>{item.challengeTitle || item.course || "Challenge"}</div></div>
                  <strong style={{ color: "#139b91", whiteSpace: "nowrap" }}>{item.score}/{item.totalPoints}</strong>
                </div>)}
              </div>}
            </div>
            <div className="workspace-card" style={{ padding: 20 }}>
              <h3 style={{ color: "#18334f", marginTop: 0 }}>Your Challenge History</h3>
              {peerChallengeLoading ? <p className="demo-note">Loading your attempts...</p> : peerChallengeSubmissions.filter((item) => item.studentId === auth.currentUser?.uid).length === 0 ? <p className="demo-note">Your completed challenges will appear here.</p> : <div style={{ display: "grid", gap: 9 }}>
                {peerChallengeSubmissions.filter((item) => item.studentId === auth.currentUser?.uid).slice(0, 8).map((item) => <div key={item.id} style={{ padding: 11, border: "1px solid #e7edf3", borderRadius: 10 }}><strong style={{ color: "#18334f" }}>{item.challengeTitle}</strong><div className="demo-note" style={{ marginTop: 4 }}>{item.course} · {item.correctCount}/{item.questionCount} correct</div><strong style={{ color: "#139b91" }}>{item.score}/{item.totalPoints} points</strong></div>)}
              </div>}
            </div>
          </div>
          <p className="demo-note" style={{ marginTop: 14 }}>Challenge answers are checked in the browser and each result is saved in Firestore <code>challengeSubmissions</code>. The leaderboard displays each learner's best score for each challenge.</p>
        </section>

        {/* COURSE DISCUSSION FORUM */}
        <section className="dashboard-section" id="course-discussions">
          <div className="dashboard-section-heading"><div><span>LEARN TOGETHER</span><h2>Course Discussion Forum</h2><p className="section-description">Ask questions, share explanations and learn with students and faculty.</p></div></div>
          {discussionError && <p className="auth-error" role="alert">{discussionError}</p>}
          {discussionMessage && <p className="success-message" role="status">{discussionMessage}</p>}
          <div className="workspace-card" style={{ padding: 22, marginBottom: 20 }}>
            <h3 style={{ color: "#18334f", marginTop: 0 }}>Ask a course question</h3>
            <form onSubmit={createDiscussion} style={{ display: "grid", gap: 13 }}>
              <label className="full-label">Course<select value={discussionCourse} onChange={(event) => setDiscussionCourse(event.target.value)}>{["Python Programming", "Java Programming", "Web Development", "Data Structures", "Artificial Intelligence", "Database Management"].map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="full-label">Question title<input value={discussionTitle} onChange={(event) => setDiscussionTitle(event.target.value)} placeholder="e.g. What is the difference between for and while loops?" maxLength={120} required /></label>
              <label className="full-label">Explain your doubt<textarea rows={4} value={discussionBody} onChange={(event) => setDiscussionBody(event.target.value)} placeholder="Add details so other learners can understand your question..." maxLength={4000} required /></label>
              <div><button className="primary-action" type="submit" disabled={discussionSaving}>{discussionSaving ? "Posting..." : "Post Question"}</button></div>
            </form>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <input aria-label="Search discussions" value={discussionSearch} onChange={(event) => setDiscussionSearch(event.target.value)} placeholder="Search questions or topics..." style={{ flex: "1 1 240px", minWidth: 0 }} />
            <select aria-label="Filter discussions by status" value={discussionFilter} onChange={(event) => setDiscussionFilter(event.target.value)} style={{ minWidth: 150 }}><option value="all">All questions</option><option value="open">Open questions</option><option value="resolved">Resolved</option></select>
          </div>
          {discussionsLoading ? <div className="workspace-card"><p className="demo-note">Loading course discussions...</p></div> : discussions.filter((item) => (discussionFilter === "all" || item.status === discussionFilter) && `${item.title} ${item.body} ${item.course}`.toLowerCase().includes(discussionSearch.toLowerCase())).length === 0 ? <div className="workspace-card" style={{ textAlign: "center", padding: 28 }}><div style={{ fontSize: 34 }}>💬</div><h3 style={{ color: "#18334f" }}>No questions found</h3><p className="demo-note">Be the first to start a helpful course discussion.</p></div> : <div style={{ display: "grid", gap: 14 }}>
            {discussions.filter((item) => (discussionFilter === "all" || item.status === discussionFilter) && `${item.title} ${item.body} ${item.course}`.toLowerCase().includes(discussionSearch.toLowerCase())).map((discussion) => {
              const canManage = discussion.authorId === auth.currentUser?.uid || ["faculty", "admin"].includes(accountRole);
              const replies = discussionReplies[discussion.id] || [];
              return <article className="workspace-card" key={discussion.id} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}><span style={{ color: "#139b91", fontSize: 12, fontWeight: 700 }}>{discussion.course}</span><span style={{ borderRadius: 20, padding: "6px 10px", fontSize: 11, fontWeight: 700, background: discussion.status === "resolved" ? "#e8f7ef" : "#fff6e8", color: discussion.status === "resolved" ? "#167345" : "#946200" }}>{discussion.status === "resolved" ? "RESOLVED" : "OPEN"}</span></div>
                <h3 style={{ color: "#18334f", margin: "9px 0 6px" }}>{discussion.title}</h3>
                <p style={{ color: "#526174", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{discussion.body}</p>
                <p className="demo-note">Asked by {discussion.authorName || "Student"}{discussion.authorRole && ["faculty", "admin"].includes(discussion.authorRole) ? " · Faculty" : ""} · {discussion.course}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="secondary-action" onClick={() => toggleDiscussionReplies(discussion)}>{expandedDiscussionId === discussion.id ? "Hide Replies" : `View / Reply (${discussionReplies[discussion.id]?.length ?? "…"})`}</button>
                  {canManage && <button type="button" className="secondary-action" onClick={() => toggleDiscussionResolved(discussion)}>{discussion.status === "resolved" ? "Reopen Question" : "Mark Resolved"}</button>}
                </div>
                {expandedDiscussionId === discussion.id && <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e5ebf2" }}>
                  <strong style={{ color: "#18334f" }}>Replies</strong>
                  {replies.length === 0 ? <p className="demo-note">No replies yet. Add the first helpful answer.</p> : replies.map((reply) => <div key={reply.id} style={{ background: "#f7fafc", borderRadius: 10, padding: 12, marginTop: 9 }}><strong style={{ color: "#18334f" }}>{reply.authorName || "Learner"}{["faculty", "admin"].includes(reply.authorRole) && <span style={{ color: "#139b91", fontSize: 11 }}> · FACULTY</span>}</strong><p style={{ color: "#526174", whiteSpace: "pre-wrap", marginBottom: 0 }}>{reply.body}</p></div>)}
                  <label className="full-label" style={{ marginTop: 12 }}>Your reply<textarea rows={3} value={replyDrafts[discussion.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [discussion.id]: event.target.value }))} placeholder="Write a helpful answer..." maxLength={3000} /></label>
                  <button type="button" className="primary-action" onClick={() => postDiscussionReply(discussion)} disabled={replySavingId === discussion.id}>{replySavingId === discussion.id ? "Posting..." : "Post Reply"}</button>
                </div>}
              </article>;
            })}
          </div>}
          <p className="demo-note" style={{ marginTop: 14 }}>Questions are saved in Firestore <code>courseDiscussions</code>; replies are saved in each question's <code>replies</code> subcollection.</p>
        </section>

        {/* FEATURE 23 — INTERACTIVE PRACTICE LAB */}
        <InteractivePracticeLab />

        {/* FEATURE 24 — DIGITAL LIBRARY & NOTES MANAGER */}
        <DigitalLibraryNotesManager />

        {/* FEATURE 25 — SMART EXAM SIMULATOR */}
        <SmartExamSimulator />

        {/* FEATURE 26 — AI INTERVIEW PREPARATION STUDIO */}
        <AIInterviewPreparationStudio />

        {/* FEATURE 27 — AI EDUCATIONAL ESCAPE ROOM */}
        <AIEducationalEscapeRoom />

        {/* FEATURE 28 — AI DEBATE ARENA */}
        <AIDebateArena />

        {/* FEATURE 22 — CONCEPT MAP & MIND MAP STUDIO */}
        <ConceptMapStudio />

        {/* FEATURE 21 — ACCESSIBILITY & MULTILINGUAL LEARNING ASSISTANT */}
        <AccessibilityLearningAssistant onNavigate={goTo} navigationItems={navItems} />

        {/* SETTINGS — ACCOUNT, NOTIFICATIONS, APPEARANCE & SECURITY */}
        <section className="dashboard-section smart-settings" id="settings">
          <style>{`
            .smart-settings .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
            .smart-settings .settings-panel{background:#fff;border:1px solid #dfe8f2;border-radius:18px;padding:22px;box-shadow:0 8px 24px rgba(20,45,75,.045);min-width:0}
            .smart-settings .settings-panel h3{margin:0 0 18px;color:#142b49;font-size:20px}
            .smart-settings .settings-muted{color:#71829b;font-size:13px;line-height:1.5}
            .smart-settings .settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #edf1f6}
            .smart-settings .settings-row:last-child{border-bottom:0}
            .smart-settings .settings-toggle{width:48px;height:27px;accent-color:#13a69b;cursor:pointer}
            .smart-settings .settings-choice{border:1px solid #dbe5ef;border-radius:12px;padding:13px;background:#f8fafc;color:#213956;cursor:pointer;font-weight:700;min-width:82px}
            .smart-settings .settings-choice.active{border:2px solid #13a69b;background:#e8faf7;color:#087e75}
            .smart-settings .settings-action{border:1px solid #b9d8df;border-radius:10px;padding:10px 16px;background:#fff;color:#078e87;font-weight:700;cursor:pointer}
            .smart-settings .settings-action.primary{background:#13a69b;color:#fff;border-color:#13a69b}
            .smart-settings .settings-action:disabled{opacity:.6;cursor:not-allowed}
            html[data-smartlearn-theme="dark"] .dashboard-layout{background:#0b1728!important;color:#e7eef8}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-panel{background:#14243a!important;border-color:#2c405a!important}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-panel h3,html[data-smartlearn-theme="dark"] .smart-settings .settings-panel strong{color:#e7eef8!important}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-muted{color:#a9bad0!important}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-row{border-color:#2c405a!important}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-choice{background:#1c304b;color:#e7eef8;border-color:#405675}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-choice.active{background:#124c4a;border-color:#13a69b}
            html[data-smartlearn-theme="dark"] .smart-settings .settings-action:not(.primary){background:#1c304b;color:#7de2d8;border-color:#405675}
            html.smartlearn-high-contrast .dashboard-layout{filter:contrast(1.12)}
            html.smartlearn-reduced-motion *,html.smartlearn-reduced-motion *::before,html.smartlearn-reduced-motion *::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
            @media(max-width:850px){.smart-settings .settings-grid{grid-template-columns:1fr}}
          `}</style>
          <div className="dashboard-section-heading">
            <div><span>PREFERENCES</span><h2>Settings</h2><p className="section-description">Manage your account and preferences in one place.</p></div>
          </div>

          <div className="settings-grid">
            <div className="settings-panel">
              <h3>👤 Account Settings</h3>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
                <div style={{width:68,height:68,borderRadius:"50%",background:"linear-gradient(135deg,#2787d5,#1762ad)",color:"white",display:"grid",placeItems:"center",fontSize:30,fontWeight:800}}>{(profile.name || auth.currentUser?.displayName || "S").slice(0,1).toUpperCase()}</div>
                <div><strong style={{fontSize:18,color:"#142b49"}}>{profile.name || auth.currentUser?.displayName || "Student"}</strong><div className="settings-muted">{auth.currentUser?.email || profile.email || "Not signed in"}</div></div>
              </div>
              <div className="settings-row"><span><strong>Email</strong><div className="settings-muted">Your sign-in email address</div></span><span style={{color:"#526782",fontSize:13,overflowWrap:"anywhere"}}>{auth.currentUser?.email || profile.email || "—"}</span></div>
              <div className="settings-row"><span><strong>Role</strong><div className="settings-muted">Your SmartLearn account role</div></span><span className="settings-status">{accountRole || "Student"}</span></div>
              <div className="settings-row"><span><strong>Display name</strong><div className="settings-muted">Update your name in My Profile</div></span><button type="button" className="settings-action" onClick={() => goTo("profile")}>Edit profile</button></div>
            </div>

            <div className="settings-panel">
              <h3>🔔 Notification Preferences</h3>
              {[["courseUpdates","Course Updates","Get notified about new courses and learning content."],["studyReminders","Study Reminders","Receive reminders for planned study sessions."],["announcementAlerts","Announcements","Get important course announcements."],["deadlineAlerts","Assignment Deadlines","Receive alerts about upcoming assignment due dates."]].map(([key,title,description]) => <label className="settings-row" key={key} style={{cursor:"pointer"}}><span><strong>{title}</strong><div className="settings-muted">{description}</div></span><input className="settings-toggle" type="checkbox" checked={Boolean(learningPreferences[key])} onChange={(event) => updateLearningPreference(key,event.target.checked)} aria-label={title}/></label>)}
            </div>

            <div className="settings-panel">
              <h3>🎨 Appearance</h3>
              <strong style={{display:"block",marginBottom:10,color:"#263d59"}}>Theme</strong>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>{["Light","Dark","Auto"].map((theme) => <button type="button" key={theme} className={`settings-choice ${learningPreferences.theme===theme?"active":""}`} onClick={() => updateLearningPreference("theme",theme)}>{theme==="Light"?"☀️":theme==="Dark"?"🌙":"◐"} {theme}</button>)}</div>
              <strong style={{display:"block",marginBottom:10,color:"#263d59"}}>Font Size</strong>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>{["Small","Medium","Large"].map((size) => <button type="button" key={size} className={`settings-choice ${learningPreferences.fontSize===size?"active":""}`} onClick={() => updateLearningPreference("fontSize",size)}>{size}</button>)}</div>
              <div className="settings-muted" style={{marginTop:14}}>Accessibility options</div>
              {[["highContrast","High contrast"],["reducedMotion","Reduce animations"],["readingComfort","Reading comfort"]].map(([key,title]) => <label className="settings-row" key={key}><strong>{title}</strong><input className="settings-toggle" type="checkbox" checked={Boolean(learningPreferences[key])} onChange={(event)=>updateLearningPreference(key,event.target.checked)} aria-label={title}/></label>)}
            </div>

            <div className="settings-panel">
              <h3>🔐 Privacy &amp; Security</h3>
              <div className="settings-row"><span><strong>Change Password</strong><div className="settings-muted">Receive a secure password-reset email.</div></span><button type="button" className="settings-action" onClick={async()=>{const email=auth.currentUser?.email;if(!email){setPreferencesError("Please sign in first.");return;}try{await sendPasswordResetEmail(auth,email);setPreferencesError("");setPreferencesMessage(`Password reset instructions sent to ${email}.`);}catch(error){setPreferencesError(error.message || "Could not send the password reset email.");}}}>Change</button></div>
              <div className="settings-row"><span><strong>Download Your Data</strong><div className="settings-muted">Download a copy of your profile and preferences.</div></span><button type="button" className="settings-action" onClick={async()=>{const user=auth.currentUser;if(!user){setPreferencesError("Please sign in first.");return;}try{const userSnapshot=await getDoc(doc(db,"users",user.uid));const data={exportedAt:new Date().toISOString(),uid:user.uid,email:user.email,authDisplayName:user.displayName,profile:userSnapshot.exists()?userSnapshot.data():{},preferences:learningPreferences};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="smartlearn-account-data.json";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);setPreferencesError("");setPreferencesMessage("Your account profile and preferences were downloaded.");}catch(error){setPreferencesError(error.message || "Could not export your account data.");}}}>Download</button></div>
              <div className="settings-row"><span><strong>Account Deletion</strong><div className="settings-muted">Contact your SmartLearn administrator to request account deletion.</div></span><span className="settings-status">Protected</span></div>
              <p className="settings-muted" style={{marginTop:12}}>Your learning records are stored in your private Firebase account. Account deletion is not performed from this screen.</p>
            </div>
          </div>

          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginTop:22}}>
            <button type="button" className="settings-action primary" onClick={saveLearningPreferences} disabled={preferencesSaving}>{preferencesSaving?"Saving...":"✓ Save Preferences"}</button>
            <button type="button" className="settings-action" onClick={()=>{setLearningPreferences(defaultLearningPreferences);setPreferencesMessage("");setPreferencesError("");}}>↻ Restore defaults</button>
          </div>
          {preferencesMessage && <p role="status" style={{color:"#087b50",fontSize:13,marginTop:12}}>{preferencesMessage}</p>}
          {preferencesError && <p role="alert" style={{color:"#b42318",fontSize:13,marginTop:12}}>{preferencesError}</p>}
          <p className="settings-muted" style={{marginTop:12}}>Your preferences are saved privately in your Firebase account.</p>
        </section>

        <footer className="dashboard-footer">
          © 2026 SmartLearn AI. Keep learning, keep growing!
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;