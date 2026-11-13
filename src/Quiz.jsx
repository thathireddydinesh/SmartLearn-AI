
import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const emptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  marks: 1,
});

const styles = `
  .slq-page{min-height:100vh;background:#f5f8fa;color:#172b4d;padding:30px;font-family:Inter,Arial,sans-serif}
  .slq-wrap{max-width:1180px;margin:0 auto}
  .slq-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:26px}
  .slq-eyebrow{font-size:12px;font-weight:800;letter-spacing:1.4px;color:#0e9f9a;text-transform:uppercase}
  .slq-title{font-size:30px;font-weight:800;margin:6px 0;color:#172b4d}
  .slq-sub{color:#64748b;margin:0;line-height:1.5}
  .slq-btn{border:0;border-radius:10px;padding:11px 16px;font-weight:700;cursor:pointer;background:#0e9f9a;color:white}
  .slq-btn:disabled{opacity:.55;cursor:not-allowed}
  .slq-btn.secondary{background:#e5f5f4;color:#087f7b}
  .slq-btn.ghost{background:#eef2f6;color:#334155}
  .slq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
  .slq-card{background:white;border:1px solid #e6edf1;border-radius:16px;padding:20px;box-shadow:0 5px 18px rgba(23,43,77,.045)}
  .slq-card h3{margin:0 0 9px;font-size:18px;color:#172b4d}
  .slq-muted{color:#718096;font-size:13px;line-height:1.5}
  .slq-pill{display:inline-block;border-radius:30px;background:#e7f7f5;color:#087f7b;padding:5px 10px;font-size:11px;font-weight:800;text-transform:uppercase}
  .slq-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .slq-input,.slq-select,.slq-textarea{width:100%;box-sizing:border-box;border:1px solid #dbe4ea;border-radius:9px;padding:11px 12px;font:inherit;color:#172b4d;background:white;outline:none}
  .slq-input:focus,.slq-select:focus,.slq-textarea:focus{border-color:#0e9f9a;box-shadow:0 0 0 3px #0e9f9a18}
  .slq-textarea{min-height:80px;resize:vertical}
  .slq-field{display:grid;gap:7px;margin:13px 0}
  .slq-field label{font-size:13px;font-weight:700;color:#475569}
  .slq-section{margin:24px 0 12px;font-size:17px;font-weight:800}
  .slq-option{display:flex;gap:9px;align-items:center;margin:8px 0}
  .slq-option input[type=text]{flex:1}
  .slq-alert{padding:12px 14px;border-radius:10px;background:#fff7e6;color:#8a5a00;margin:14px 0;font-size:14px}
  .slq-success{padding:12px 14px;border-radius:10px;background:#e8f7ef;color:#176b43;margin:14px 0;font-size:14px}
  .slq-question{border:1px solid #e6edf1;border-radius:13px;padding:16px;margin:14px 0}
  .slq-answer{display:flex;gap:10px;align-items:flex-start;padding:11px;border:1px solid #e6edf1;border-radius:10px;margin:8px 0;cursor:pointer}
  .slq-answer.selected{border-color:#0e9f9a;background:#effaf9}
  .slq-stat{font-size:27px;font-weight:800;color:#0e9f9a}
  @media(max-width:600px){.slq-page{padding:18px}.slq-title{font-size:25px}}
`;

export default function QuizPage() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [duration, setDuration] = useState(20);
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const isStaff = role === "faculty" || role === "admin";

  const totalMarks = useMemo(
    () =>
      questions.reduce(
        (sum, question) =>
          sum + Math.max(1, Number(question.marks) || 1),
        0
      ),
    [questions]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);

        if (!currentUser) {
          setRole("student");
          setQuizzes([]);
          setAttempts([]);
          setLoading(false);
          return;
        }

        try {
          const profileSnap = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          const profileRole = profileSnap.exists()
            ? profileSnap.data().role
            : "student";

          setRole(profileRole || "student");

          await loadData(
            currentUser.uid,
            profileRole || "student"
          );
        } catch (err) {
          setError(
            err.message || "Unable to load quiz information."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  async function loadData(uid = user?.uid, currentRole = role) {
    if (!uid) return;

    const quizSnapshot = await getDocs(
      collection(db, "quizzes")
    );

    const quizRows = quizSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    setQuizzes(
      quizRows.filter(
        (item) =>
          currentRole === "faculty" ||
          currentRole === "admin" ||
          item.published === true
      )
    );

    const attemptQuery =
      currentRole === "faculty" || currentRole === "admin"
        ? collection(db, "quizAttempts")
        : query(
            collection(db, "quizAttempts"),
            where("studentId", "==", uid)
          );

    const attemptSnapshot = await getDocs(attemptQuery);

    setAttempts(
      attemptSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
    );
  }

  function updateQuestion(index, key, value) {
    setQuestions((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      )
    );
  }

  function updateOption(questionIndex, optionIndex, value) {
    setQuestions((previous) =>
      previous.map((item, i) => {
        if (i !== questionIndex) return item;

        const options = [...item.options];
        options[optionIndex] = value;

        return { ...item, options };
      })
    );
  }

  async function createQuiz(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    if (!user) {
      return setError(
        "Please sign in before creating a quiz."
      );
    }

    const cleanedQuestions = questions.map((item) => ({
      question: item.question.trim(),
      options: item.options.map((option) => option.trim()),
      correctAnswer: Number(item.correctAnswer),
      marks: Math.max(1, Number(item.marks) || 1),
    }));

    if (!quizTitle.trim()) {
      return setError("Enter a quiz title.");
    }

    if (
      cleanedQuestions.some(
        (item) =>
          !item.question ||
          item.options.some((option) => !option)
      )
    ) {
      return setError(
        "Add a question and fill in all four options for every question."
      );
    }

    setBusy(true);

    try {
      await addDoc(collection(db, "quizzes"), {
        title: quizTitle.trim(),
        description: quizDescription.trim(),
        duration: Math.max(1, Number(duration) || 20),
        questions: cleanedQuestions,
        totalMarks: cleanedQuestions.reduce(
          (sum, item) => sum + item.marks,
          0
        ),
        published: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setQuizTitle("");
      setQuizDescription("");
      setDuration(20);
      setQuestions([emptyQuestion()]);
      setShowBuilder(false);

      setNotice(
        "Quiz saved as a draft. Publish it when it is ready for students."
      );

      await loadData(user.uid, role);
    } catch (err) {
      setError(err.message || "Could not create the quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(quiz) {
    setBusy(true);
    setError("");

    try {
      await updateDoc(doc(db, "quizzes", quiz.id), {
        published: !quiz.published,
        updatedAt: serverTimestamp(),
      });

      setNotice(
        quiz.published
          ? "Quiz moved back to drafts."
          : "Quiz published for students."
      );

      await loadData(user.uid, role);
    } catch (err) {
      setError(err.message || "Could not update the quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAttempt() {
    if (!activeQuiz || !user) return;

    const unanswered = activeQuiz.questions.some(
      (_, index) => answers[index] === undefined
    );

    if (
      unanswered &&
      !window.confirm(
        "Some questions are unanswered. Submit anyway?"
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      let score = 0;
      let possible = 0;

      const review = activeQuiz.questions.map(
        (question, index) => {
          const marks = Math.max(
            1,
            Number(question.marks) || 1
          );

          possible += marks;

          const correct =
            Number(answers[index]) ===
            Number(question.correctAnswer);

          if (correct) score += marks;

          return {
            question: question.question,
            selectedAnswer: answers[index] ?? null,
            correctAnswer: Number(question.correctAnswer),
            correct,
            marks,
          };
        }
      );

      await addDoc(collection(db, "quizAttempts"), {
        quizId: activeQuiz.id,
        quizTitle: activeQuiz.title,
        studentId: user.uid,
        studentEmail: user.email || "",
        answers: review,
        score,
        totalMarks: possible,
        submittedAt: serverTimestamp(),
      });

      setActiveQuiz(null);
      setAnswers({});

      setNotice(
        `Quiz submitted. Your score: ${score} / ${possible}.`
      );

      await loadData(user.uid, role);
    } catch (err) {
      setError(err.message || "Could not submit your quiz.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="slq-page">
        <style>{styles}</style>
        <div className="slq-wrap">
          Loading Quiz Centre…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="slq-page">
        <style>{styles}</style>
        <div className="slq-wrap">
          <h1 className="slq-title">Quiz Centre</h1>
          <div className="slq-card">
            Please sign in to access quizzes.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slq-page">
      <style>{styles}</style>

      <div className="slq-wrap">
        <header className="slq-top">
          <div>
            <div className="slq-eyebrow">
              SmartLearn AI · Learning assessment
            </div>

            <h1 className="slq-title">Quiz Centre</h1>

            <p className="slq-sub">
              Practice what you learn, check your progress,
              and grow with every attempt.
            </p>
          </div>

          {isStaff && (
            <button
              className="slq-btn"
              onClick={() => {
                setShowBuilder((value) => !value);
                setActiveQuiz(null);
              }}
            >
              {showBuilder ? "Close builder" : "+ Create quiz"}
            </button>
          )}
        </header>

        {error && (
          <div className="slq-alert">{error}</div>
        )}

        {notice && (
          <div className="slq-success">{notice}</div>
        )}

        {showBuilder && isStaff && (
          <form
            className="slq-card"
            onSubmit={createQuiz}
          >
            <div className="slq-row">
              <h2
                className="slq-section"
                style={{ marginTop: 0 }}
              >
                Create a new quiz
              </h2>

              <span className="slq-pill">
                Faculty / Admin
              </span>
            </div>

            <div className="slq-field">
              <label>Quiz title</label>
              <input
                className="slq-input"
                value={quizTitle}
                onChange={(e) =>
                  setQuizTitle(e.target.value)
                }
                placeholder="e.g. JavaScript Fundamentals"
                required
              />
            </div>

            <div className="slq-field">
              <label>Description</label>
              <textarea
                className="slq-textarea"
                value={quizDescription}
                onChange={(e) =>
                  setQuizDescription(e.target.value)
                }
                placeholder="What will students learn or demonstrate?"
              />
            </div>

            <div
              className="slq-field"
              style={{ maxWidth: 220 }}
            >
              <label>Duration (minutes)</label>
              <input
                className="slq-input"
                type="number"
                min="1"
                value={duration}
                onChange={(e) =>
                  setDuration(e.target.value)
                }
              />
            </div>

            <h3 className="slq-section">
              Questions · {totalMarks} total marks
            </h3>

            {questions.map((question, index) => (
              <div className="slq-question" key={index}>
                <div className="slq-row">
                  <strong>Question {index + 1}</strong>

                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="slq-btn ghost"
                      onClick={() =>
                        setQuestions((old) =>
                          old.filter((_, i) => i !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="slq-field">
                  <label>Question text</label>
                  <textarea
                    className="slq-textarea"
                    value={question.question}
                    onChange={(e) =>
                      updateQuestion(
                        index,
                        "question",
                        e.target.value
                      )
                    }
                    placeholder="Enter your question"
                    required
                  />
                </div>

                <div
                  className="slq-muted"
                  style={{ fontWeight: 700 }}
                >
                  Options — select the radio button beside
                  the correct answer
                </div>

                {question.options.map(
                  (option, optionIndex) => (
                    <div
                      className="slq-option"
                      key={optionIndex}
                    >
                      <input
                        type="radio"
                        name={`correct-${index}`}
                        checked={
                          Number(question.correctAnswer) ===
                          optionIndex
                        }
                        onChange={() =>
                          updateQuestion(
                            index,
                            "correctAnswer",
                            optionIndex
                          )
                        }
                        aria-label={`Mark option ${
                          optionIndex + 1
                        } correct`}
                      />

                      <input
                        className="slq-input"
                        type="text"
                        value={option}
                        onChange={(e) =>
                          updateOption(
                            index,
                            optionIndex,
                            e.target.value
                          )
                        }
                        placeholder={`Option ${
                          optionIndex + 1
                        }`}
                        required
                      />
                    </div>
                  )
                )}

                <div
                  className="slq-field"
                  style={{ maxWidth: 160 }}
                >
                  <label>Marks</label>
                  <input
                    className="slq-input"
                    type="number"
                    min="1"
                    value={question.marks}
                    onChange={(e) =>
                      updateQuestion(
                        index,
                        "marks",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            ))}

            <div className="slq-row">
              <button
                type="button"
                className="slq-btn secondary"
                onClick={() =>
                  setQuestions((old) => [
                    ...old,
                    emptyQuestion(),
                  ])
                }
              >
                + Add question
              </button>

              <button
                className="slq-btn"
                type="submit"
                disabled={busy}
              >
                {busy ? "Saving…" : "Save as draft"}
              </button>
            </div>
          </form>
        )}

        {activeQuiz && (
          <section className="slq-card">
            <div className="slq-row">
              <div>
                <span className="slq-pill">
                  Quiz in progress
                </span>

                <h2
                  className="slq-title"
                  style={{ fontSize: 24 }}
                >
                  {activeQuiz.title}
                </h2>

                <p className="slq-muted">
                  {activeQuiz.description}
                </p>
              </div>

              <button
                className="slq-btn ghost"
                onClick={() => {
                  setActiveQuiz(null);
                  setAnswers({});
                }}
              >
                Exit quiz
              </button>
            </div>

            <p className="slq-muted">
              {activeQuiz.duration || 20} minute time limit
              {" · "}
              {activeQuiz.questions.length} questions
              {" · "}
              {activeQuiz.totalMarks ||
                activeQuiz.questions.reduce(
                  (sum, q) =>
                    sum + (Number(q.marks) || 1),
                  0
                )}{" "}
              marks
            </p>

            {activeQuiz.questions.map(
              (question, index) => (
                <div
                  className="slq-question"
                  key={index}
                >
                  <strong>
                    {index + 1}. {question.question}
                  </strong>

                  <span className="slq-muted">
                    {" "}
                    · {question.marks || 1} mark(s)
                  </span>

                  {question.options.map(
                    (option, optionIndex) => (
                      <label
                        className={`slq-answer ${
                          Number(answers[index]) ===
                          optionIndex
                            ? "selected"
                            : ""
                        }`}
                        key={optionIndex}
                      >
                        <input
                          type="radio"
                          name={`answer-${index}`}
                          checked={
                            Number(answers[index]) ===
                            optionIndex
                          }
                          onChange={() =>
                            setAnswers((old) => ({
                              ...old,
                              [index]: optionIndex,
                            }))
                          }
                        />

                        <span>{option}</span>
                      </label>
                    )
                  )}
                </div>
              )
            )}

            <button
              className="slq-btn"
              disabled={busy}
              onClick={submitAttempt}
            >
              {busy ? "Submitting…" : "Submit quiz"}
            </button>
          </section>
        )}

        {!activeQuiz && !showBuilder && (
          <>
            <div
              className="slq-grid"
              style={{ marginBottom: 24 }}
            >
              <div className="slq-card">
                <div className="slq-muted">
                  {isStaff
                    ? "Total quizzes"
                    : "Available quizzes"}
                </div>

                <div className="slq-stat">
                  {quizzes.length}
                </div>
              </div>

              <div className="slq-card">
                <div className="slq-muted">
                  {isStaff
                    ? "Student submissions"
                    : "Quizzes attempted"}
                </div>

                <div className="slq-stat">
                  {attempts.length}
                </div>
              </div>

              {!isStaff && (
                <div className="slq-card">
                  <div className="slq-muted">
                    Average score
                  </div>

                  <div className="slq-stat">
                    {attempts.length
                      ? `${Math.round(
                          (attempts.reduce(
                            (sum, item) =>
                              sum +
                              (Number(item.totalMarks)
                                ? (item.score /
                                    item.totalMarks) *
                                  100
                                : 0),
                            0
                          ) /
                            attempts.length)
                        )}%`
                      : "—"}
                  </div>
                </div>
              )}
            </div>

            <h2 className="slq-section">
              {isStaff
                ? "Manage quizzes"
                : "Published quizzes"}
            </h2>

            {quizzes.length === 0 ? (
              <div className="slq-card">
                <h3>No quizzes yet</h3>

                <p className="slq-muted">
                  {isStaff
                    ? "Create a quiz and publish it when it is ready."
                    : "Your faculty has not published a quiz yet. Check back soon."}
                </p>
              </div>
            ) : (
              <div className="slq-grid">
                {quizzes.map((quiz) => (
                  <article
                    className="slq-card"
                    key={quiz.id}
                  >
                    <div className="slq-row">
                      <span className="slq-pill">
                        {quiz.published
                          ? "Published"
                          : "Draft"}
                      </span>

                      <span className="slq-muted">
                        {quiz.duration || 20} min
                      </span>
                    </div>

                    <h3 style={{ marginTop: 14 }}>
                      {quiz.title}
                    </h3>

                    <p className="slq-muted">
                      {quiz.description ||
                        "No description provided."}
                    </p>

                    <p className="slq-muted">
                      {quiz.questions?.length || 0} questions
                      {" · "}
                      {quiz.totalMarks || 0} marks
                    </p>

                    <div
                      className="slq-row"
                      style={{ marginTop: 16 }}
                    >
                      {isStaff ? (
                        <button
                          className="slq-btn secondary"
                          disabled={busy}
                          onClick={() =>
                            togglePublish(quiz)
                          }
                        >
                          {quiz.published
                            ? "Unpublish"
                            : "Publish quiz"}
                        </button>
                      ) : (
                        <button
                          className="slq-btn"
                          onClick={() => {
                            setActiveQuiz(quiz);
                            setAnswers({});
                            setNotice("");
                          }}
                        >
                          Start quiz
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <h2 className="slq-section">
              {isStaff
                ? "Recent student submissions"
                : "Your quiz history"}
            </h2>

            {attempts.length === 0 ? (
              <div className="slq-card">
                <p className="slq-muted">
                  No submissions to show yet.
                </p>
              </div>
            ) : (
              <div
                className="slq-card"
                style={{ overflowX: "auto" }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ color: "#64748b" }}>
                      <th style={{ padding: 10 }}>Quiz</th>

                      {isStaff && (
                        <th style={{ padding: 10 }}>
                          Student
                        </th>
                      )}

                      <th style={{ padding: 10 }}>Score</th>
                      <th style={{ padding: 10 }}>
                        Submitted
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {attempts.map((attempt) => (
                      <tr
                        key={attempt.id}
                        style={{
                          borderTop: "1px solid #edf1f4",
                        }}
                      >
                        <td
                          style={{
                            padding: 10,
                            fontWeight: 700,
                          }}
                        >
                          {attempt.quizTitle}
                        </td>

                        {isStaff && (
                          <td style={{ padding: 10 }}>
                            {attempt.studentEmail ||
                              attempt.studentId}
                          </td>
                        )}

                        <td style={{ padding: 10 }}>
                          {attempt.score} /{" "}
                          {attempt.totalMarks}
                        </td>

                        <td style={{ padding: 10 }}>
                          {attempt.submittedAt?.toDate
                            ? attempt.submittedAt
                                .toDate()
                                .toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
