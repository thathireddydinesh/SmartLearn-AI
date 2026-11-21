

import { useState, useEffect } from "react";

import "./App.css";

import Dashboard from "./Dashboard.jsx";

import Auth from "./Auth.jsx";



// BACKEND API

const API_URL = (import.meta.env.VITE_API_URL || "https://smartlearn-ai-api.onrender.com").replace(/\/+$/, "");



// FEATURES

const features = [

  ["🧠", "AI Quiz Generator", "Generate quizzes automatically from your study materials."],

  ["📚", "Smart Summaries", "Convert lengthy notes into easy-to-understand summaries."],

  ["🎯", "Personalized Learning", "Get recommendations based on your learning progress."],

  ["🗂️", "AI Flashcards", "Remember important concepts with smart flashcards."],

  ["📊", "Performance Analytics", "Track your progress and identify weak topics."],

  ["⚡", "Instant Evaluation", "Get instant quiz results and explanations."]

];



// COURSE ICONS

const courseIcons = {

  "Python Programming": "🐍",

  "Java Programming": "☕",

  "Web Development": "💻",

  "Data Structures": "🧮",

  "Artificial Intelligence": "🤖",

  "Database Management": "🗄️"

};



// PUBLIC CERTIFICATE VERIFICATION PAGE

function CertificateVerification({ certificateId }) {

  const [loading, setLoading] = useState(true);

  const [certificate, setCertificate] = useState(null);

  const [valid, setValid] = useState(false);

  const [error, setError] = useState("");



  useEffect(() => {

    const verifyCertificate = async () => {

      try {

        setLoading(true);

        setError("");

        setCertificate(null);

        setValid(false);



        if (!certificateId) {

          setError("Certificate ID is missing.");

          return;

        }



        const response = await fetch(

          `${API_URL}/api/certificates/verify/${encodeURIComponent(certificateId)}`

        );



        const data = await response.json();



        if (!response.ok) {

          setValid(false);

          setError(

            data.detail || data.message || "Certificate not found."

          );

          return;

        }



        // Supports both { valid: true, certificate: {...} }

        // and direct certificate response formats.

        const certificateData = data.certificate || data;



        const isValid =

          data.valid === true ||

          data.status === "valid" ||

          certificateData.valid === true;



        if (isValid) {

          setCertificate(certificateData);

          setValid(true);

        } else {

          setValid(false);

          setError(

            data.message || "This certificate is invalid or does not exist."

          );

        }

      } catch (err) {

        console.error("Certificate verification error:", err);

        setError(

          "Unable to connect to the verification server. Please try again later."

        );

      } finally {

        setLoading(false);

      }

    };



    verifyCertificate();

  }, [certificateId]);



  return (

    <div

      style={{

        minHeight: "100vh",

        background: "#f4f8fc",

        display: "flex",

        justifyContent: "center",

        alignItems: "center",

        padding: "25px",

        fontFamily: "Arial, sans-serif"

      }}

    >

      <div

        style={{

          background: "#ffffff",

          width: "100%",

          maxWidth: "650px",

          padding: "40px 30px",

          borderRadius: "18px",

          boxShadow: "0 8px 35px rgba(0,0,0,0.08)",

          textAlign: "center"

        }}

      >

        <div

          style={{

            fontSize: "35px",

            fontWeight: "bold",

            color: "#13a69b",

            marginBottom: "8px"

          }}

        >

          SmartLearn AI

        </div>



        <h1 style={{ color: "#183e5c", marginBottom: "10px" }}>

          Certificate Verification

        </h1>



        <p style={{ color: "#64748b", marginBottom: "30px" }}>

          Verify the authenticity of a SmartLearn AI certificate.

        </p>



        <div

          style={{

            background: "#f1f5f9",

            padding: "15px",

            borderRadius: "10px",

            marginBottom: "25px",

            overflowWrap: "anywhere"

          }}

        >

          <strong style={{ color: "#475569" }}>

            Certificate ID

          </strong>



          <p

            style={{

              color: "#183e5c",

              fontWeight: "bold",

              margin: "8px 0 0"

            }}

          >

            {certificateId || "Not provided"}

          </p>

        </div>



        {loading && (

          <div style={{ padding: "25px", color: "#64748b" }}>

            <h3>Verifying Certificate...</h3>

            <p>Please wait while we check our records.</p>

          </div>

        )}



        {!loading && valid && certificate && (

          <div

            style={{

              border: "2px solid #16a34a",

              borderRadius: "12px",

              padding: "25px",

              background: "#f0fdf4",

              textAlign: "left"

            }}

          >

            <div

              style={{

                textAlign: "center",

                color: "#15803d",

                fontSize: "24px",

                fontWeight: "bold",

                marginBottom: "20px"

              }}

            >

              ✓ VALID CERTIFICATE

            </div>



            <p>

              <strong>Student Name:</strong>{" "}

              {certificate.studentName || "Not available"}

            </p>



            <p>

              <strong>Course Name:</strong>{" "}

              {certificate.courseName || "Not available"}

            </p>



            <p>

              <strong>Certificate ID:</strong>{" "}

              {certificate.certificateId || certificateId}

            </p>



            <p>

              <strong>Completion Date:</strong>{" "}

              {certificate.completionDate || "Not available"}

            </p>



            <div

              style={{

                textAlign: "center",

                marginTop: "20px",

                color: "#15803d",

                fontWeight: "bold"

              }}

            >

              This certificate has been successfully verified in

              SmartLearn AI records.

            </div>

          </div>

        )}



        {!loading && !valid && (

          <div

            style={{

              border: "2px solid #dc2626",

              borderRadius: "12px",

              padding: "25px",

              background: "#fef2f2"

            }}

          >

            <h2 style={{ color: "#dc2626" }}>

              ✕ INVALID CERTIFICATE

            </h2>



            <p style={{ color: "#991b1b" }}>

              {error || "This certificate could not be verified."}

            </p>



            <p style={{ color: "#64748b", fontSize: "14px" }}>

              Please check the certificate ID and try again.

            </p>

          </div>

        )}



        <button

          onClick={() => {

            window.location.href = "/";

          }}

          style={{

            marginTop: "30px",

            padding: "12px 25px",

            background: "#13a69b",

            color: "#ffffff",

            border: "none",

            borderRadius: "8px",

            cursor: "pointer",

            fontSize: "15px",

            fontWeight: "bold"

          }}

        >

          Back to SmartLearn AI

        </button>



        <p

          style={{

            marginTop: "30px",

            fontSize: "13px",

            color: "#94a3b8"

          }}

        >

          © 2026 SmartLearn AI. All rights reserved.

        </p>

      </div>

    </div>

  );

}



function App() {

  const [showDashboard, setShowDashboard] = useState(false);

  const [showAuth, setShowAuth] = useState(false);



  // DETECT PUBLIC CERTIFICATE VERIFICATION URL

  const [certificateId] = useState(() => {

    const path = window.location.pathname;

    const match = path.match(/^\/verify\/([^/]+)\/?$/);



    if (match) {

      return decodeURIComponent(match[1]);

    }



    return new URLSearchParams(window.location.search).get(

      "certificateId"

    );

  });



  const isVerificationPage =

    window.location.pathname.startsWith("/verify/") ||

    new URLSearchParams(window.location.search).has("certificateId");



  // BACKEND COURSE DATA

  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");



  // FETCH COURSES FROM FASTAPI

  useEffect(() => {

    // Do not fetch courses on the public verification page.

    if (isVerificationPage) {

      setLoading(false);

      return;

    }



    const fetchCourses = async () => {

      try {

        setLoading(true);

        setError("");



        const response = await fetch(`${API_URL}/api/courses`);



        if (!response.ok) {

          throw new Error("Unable to load courses from backend.");

        }



        const data = await response.json();



        if (!Array.isArray(data)) {

          throw new Error("Invalid course data received.");

        }



        setCourses(data);

      } catch (err) {

        console.error("Course loading error:", err);

        setError(

          "Unable to connect to the backend. Please check whether FastAPI is running."

        );

      } finally {

        setLoading(false);

      }

    };



    fetchCourses();

  }, [isVerificationPage]);



  // PUBLIC CERTIFICATE VERIFICATION

  if (isVerificationPage) {

    return (

      <CertificateVerification certificateId={certificateId} />

    );

  }



  // DASHBOARD

  if (showDashboard) {

    return (

      <Dashboard

        onBack={() => {

          setShowDashboard(false);

          setShowAuth(false);

        }}

      />

    );

  }



  // LOGIN / REGISTER

  if (showAuth) {

    return (

      <Auth

        onSuccess={() => {

          setShowAuth(false);

          setShowDashboard(true);

        }}

        onBack={() => setShowAuth(false)}

      />

    );

  }



  // SCROLL TO SECTION

  const scrollToSection = (sectionId) => {

    document.getElementById(sectionId)?.scrollIntoView({

      behavior: "smooth",

      block: "start"

    });

  };



  return (

    <div>

      {/* NAVBAR */}

      <header className="navbar">

        <a href="#home" className="logo">

          <span className="logo-icon">S</span>

          SmartLearn <b>AI</b>

        </a>



        <nav>

          <a href="#home">Home</a>

          <a href="#features">Features</a>

          <a href="#courses">Courses</a>

          <a href="#how">How It Works</a>

          <a href="#about">About</a>

        </nav>



        <button

          className="nav-button"

          onClick={() => setShowAuth(true)}

        >

          Login

        </button>

      </header>



      {/* HERO SECTION */}

      <section className="hero" id="home">

        <div className="hero-content">

          <span className="tag">✦ THE FUTURE OF SMART LEARNING</span>



          <h1>

            Learn Smarter.<br />

            Grow Faster with<br />

            <span>Artificial Intelligence.</span>

          </h1>



          <p>

            Transform your lecture notes into AI-powered quizzes,

            smart summaries and flashcards. Make every study session

            more productive with SmartLearn AI.

          </p>



          <div className="hero-buttons">

            <button

              className="primary-button"

              onClick={() => scrollToSection("courses")}

            >

              Explore Courses →

            </button>



            <button

              className="secondary-button"

              onClick={() => scrollToSection("features")}

            >

              Discover Features

            </button>

          </div>



          <div className="benefits">

            <span>✓ AI Powered</span>

            <span>✓ Personalized Learning</span>

            <span>✓ Smart Analytics</span>

          </div>

        </div>



        <div className="hero-visual">

          <div className="study-card">

            <div className="card-top">

              <span>✦ AI ASSISTANT</span>

              <span className="online">● Online</span>

            </div>



            <div className="student-image">🧑‍💻</div>



            <h2>Your AI Study Partner</h2>

            <p>Learn more effectively with intelligent tools.</p>



            <div className="generated">

              📄

              <div>

                <b>Lecture Notes.pdf</b>

                <small>Document processed</small>

              </div>

              ✓

            </div>



            <div className="generated">

              ❓

              <div>

                <b>10 Quiz Questions</b>

                <small>Ready to practice</small>

              </div>

              ✓

            </div>



            <div className="generated">

              🗂️

              <div>

                <b>15 Flashcards</b>

                <small>Successfully created</small>

              </div>

              ✓

            </div>

          </div>

        </div>

      </section>



      {/* STATISTICS */}

      <section className="stats">

        <div>

          <h2>AI Powered</h2>

          <p>Learning Experience</p>

        </div>



        <div>

          <h2>24/7</h2>

          <p>Learning Access</p>

        </div>



        <div>

          <h2>3-in-1</h2>

          <p>Smart Learning Tools</p>

        </div>



        <div>

          <h2>100%</h2>

          <p>Learning Focus</p>

        </div>

      </section>



      {/* FEATURES */}

      <section className="section" id="features">

        <div className="heading">

          <span>OUR FEATURES</span>

          <h2>

            Everything You Need to <b>Learn Better</b>

          </h2>

          <p>

            Powerful AI tools designed to make education smarter and easier.

          </p>

        </div>



        <div className="feature-grid">

          {features.map((item, index) => (

            <div className="feature-card" key={index}>

              <div className="feature-icon">{item[0]}</div>

              <h3>{item[1]}</h3>

              <p>{item[2]}</p>

              <a href="#courses">Explore Feature →</a>

            </div>

          ))}

        </div>

      </section>



      {/* HOW IT WORKS */}

      <section className="how-section" id="how">

        <div className="heading">

          <span>HOW IT WORKS</span>

          <h2>

            Three Steps to <b>Smarter Learning</b>

          </h2>

          <p>A simple process that transforms the way students learn.</p>

        </div>



        <div className="steps">

          <div className="step-card">

            <h1>01</h1>

            <div>📤</div>

            <h3>Upload Your Notes</h3>

            <p>Faculty uploads lecture notes and study materials.</p>

          </div>



          <div className="step-card">

            <h1>02</h1>

            <div>✨</div>

            <h3>AI Creates Content</h3>

            <p>AI transforms notes into quizzes and summaries.</p>

          </div>



          <div className="step-card">

            <h1>03</h1>

            <div>🎓</div>

            <h3>Learn & Practice</h3>

            <p>Students practice and improve their knowledge.</p>

          </div>

        </div>

      </section>



      {/* COURSES - LOADED FROM BACKEND */}

      <section className="section" id="courses">

        <div className="heading">

          <span>POPULAR COURSES</span>

          <h2>

            Explore Your <b>Learning Journey</b>

          </h2>

          <p>Discover courses and improve your skills every day.</p>

        </div>



        {loading && (

          <p className="course-status">

            Loading courses from SmartLearn AI backend...

          </p>

        )}



        {error && (

          <div className="course-status">

            <p>{error}</p>

            <button onClick={() => window.location.reload()}>

              Try Again

            </button>

          </div>

        )}



        {!loading && !error && courses.length === 0 && (

          <p className="course-status">No courses are available yet.</p>

        )}



        {!loading && !error && courses.length > 0 && (

          <div className="course-grid">

            {courses.map((course) => (

              <div className="course-card" key={course.id}>

                <div className="course-image">

                  <span>

                    {courseIcons[course.name] || "📘"}

                  </span>

                  <small>{course.level}</small>

                </div>



                <div className="course-content">

                  <h3>{course.name}</h3>



                  <p>{course.description}</p>



                  <div className="course-bottom">

                    <span>

                      📖 {course.lessons} Lessons

                    </span>



                    <button

                      onClick={() =>

                        alert(

                          `${course.name}\n\n${course.lesson_list?.length || 0} lessons available.`

                        )

                      }

                    >

                      Explore →

                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>



      {/* ABOUT */}

      <section className="about" id="about">

        <div className="about-art">

          <div className="circle">

            🎓

            <h2>Learn Smarter</h2>

            <p>With SmartLearn AI</p>

          </div>

        </div>



        <div className="about-content">

          <span>ABOUT SMARTLEARN AI</span>

          <h2>

            Education Meets <b>Artificial Intelligence</b>

          </h2>



          <p>

            SmartLearn AI brings students and faculty together through

            intelligent learning technology. We transform traditional

            study materials into interactive learning experiences.

          </p>



          <p>✓ Simplify complex study materials</p>

          <p>✓ Generate quizzes automatically</p>

          <p>✓ Identify learning gaps</p>

          <p>✓ Improve student performance</p>

        </div>

      </section>



      {/* CALL TO ACTION */}

      <section className="cta">

        <span>✦ YOUR LEARNING JOURNEY STARTS HERE</span>

        <h2>Ready to Learn Smarter?</h2>

        <p>Discover a better way to study with SmartLearn AI.</p>



        <button

          className="cta-button"

          onClick={() => scrollToSection("courses")}

        >

          Explore Learning Tools →

        </button>

      </section>



      {/* FOOTER */}

      <footer>

        <div className="footer-grid">

          <div>

            <a href="#home" className="logo footer-logo">

              <span className="logo-icon">S</span>

              SmartLearn <b>AI</b>

            </a>



            <p>

              Making learning smarter through Artificial Intelligence.

            </p>

          </div>



          <div>

            <h3>Quick Links</h3>

            <a href="#home">Home</a>

            <a href="#features">Features</a>

            <a href="#courses">Courses</a>

          </div>



          <div>

            <h3>Learning</h3>

            <a href="#how">How It Works</a>

            <a href="#about">About Us</a>

          </div>



          <div>

            <h3>Contact</h3>

            <p>support@smartlearn.ai</p>

            <p>AI Powered Learning Platform</p>

          </div>

        </div>



        <div className="copyright">

          © 2026 SmartLearn AI. All rights reserved.

        </div>

      </footer>

    </div>

  );

}



export default App;
