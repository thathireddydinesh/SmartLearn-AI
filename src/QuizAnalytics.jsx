
import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const styles = `
.sqa-page{color:#172b4d;font-family:inherit}
.sqa-muted{color:#64748b;font-size:13px;line-height:1.55}
.sqa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:15px;margin:18px 0}
.sqa-card{background:#fff;border:1px solid #e4ebf0;border-radius:14px;padding:18px;box-shadow:0 4px 15px rgba(23,43,77,.04);min-width:0}
.sqa-kicker{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b}
.sqa-value{font-size:28px;font-weight:800;color:#139b91;margin:8px 0 3px}
.sqa-title{font-size:18px;font-weight:800;margin:0 0 12px}
.sqa-bar{height:9px;background:#e8eef4;border-radius:20px;overflow:hidden}
.sqa-bar>span{display:block;height:100%;background:#139b91;border-radius:20px}
.sqa-table-wrap{overflow-x:auto}
.sqa-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;min-width:560px}
.sqa-table th,.sqa-table td{padding:12px 10px;border-bottom:1px solid #edf1f4}
.sqa-table th{color:#64748b;font-weight:700}
.sqa-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:24px;color:#64748b}
.sqa-tag{display:inline-block;border-radius:20px;padding:4px 9px;background:#e8f7f5;color:#087f7b;font-size:11px;font-weight:800}
.sqa-row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.sqa-error{padding:12px 14px;border-radius:10px;background:#fff2f0;color:#a33326;margin:12px 0}
`;

function percent(score, total) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function dateLabel(value) {
  const date =
    value?.toDate?.() ||
    (value instanceof Date ? value : null);

  return date ? date.toLocaleDateString() : "Date unavailable";
}

export default function QuizAnalytics() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("student");
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        setError("");

        if (!currentUser) {
          setAttempts([]);
          setLoading(false);
          return;
        }

        setLoading(true);

        try {
          const profile = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          const currentRole = profile.exists()
            ? profile.data().role || "student"
            : "student";

          setRole(currentRole);

          const staff =
            currentRole === "faculty" ||
            currentRole === "admin";

          const attemptsRef = collection(db, "quizAttempts");

          const snapshot = await getDocs(
            staff
              ? attemptsRef
              : query(
                  attemptsRef,
                  where("studentId", "==", currentUser.uid)
                )
          );

          const rows = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          rows.sort((a, b) => {
            const aTime = a.submittedAt?.toMillis?.() || 0;
            const bTime = b.submittedAt?.toMillis?.() || 0;
            return bTime - aTime;
          });

          setAttempts(rows);
        } catch (err) {
          setError(
            err.message ||
              "Could not load Quiz Centre analytics. Check your Firestore rules and connection."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const analytics = useMemo(() => {
    const totalScore = attempts.reduce(
      (sum, item) => sum + (Number(item.score) || 0),
      0
    );

    const totalPossible = attempts.reduce(
      (sum, item) => sum + (Number(item.totalMarks) || 0),
      0
    );

    const average = attempts.length
      ? Math.round(
          attempts.reduce(
            (sum, item) =>
              sum +
              percent(
                Number(item.score) || 0,
                Number(item.totalMarks) || 0
              ),
            0
          ) / attempts.length
        )
      : 0;

    const quizMap = {};
    const questionMap = {};

    attempts.forEach((attempt) => {
      const key =
        attempt.quizId ||
        attempt.quizTitle ||
        "Unknown quiz";

      if (!quizMap[key]) {
        quizMap[key] = {
          key,
          title: attempt.quizTitle || "Untitled quiz",
          attempts: 0,
          score: 0,
          possible: 0,
        };
      }

      quizMap[key].attempts += 1;
      quizMap[key].score += Number(attempt.score) || 0;
      quizMap[key].possible +=
        Number(attempt.totalMarks) || 0;

      (
        Array.isArray(attempt.answers)
          ? attempt.answers
          : []
      ).forEach((answer) => {
        const question = String(
          answer.question || ""
        ).trim();

        if (!question) return;

        if (!questionMap[question]) {
          questionMap[question] = {
            question,
            correct: 0,
            total: 0,
          };
        }

        questionMap[question].total += 1;

        if (answer.correct === true) {
          questionMap[question].correct += 1;
        }
      });
    });

    const quizRows = Object.values(quizMap)
      .map((item) => ({
        ...item,
        accuracy: percent(item.score, item.possible),
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const questionRows = Object.values(questionMap)
      .map((item) => ({
        ...item,
        accuracy: percent(item.correct, item.total),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6);

    const studentMap = {};

    attempts.forEach((attempt) => {
      const key =
        attempt.studentId ||
        attempt.studentEmail ||
        "Unknown student";

      if (!studentMap[key]) {
        studentMap[key] = {
          key,
          email: attempt.studentEmail || key,
          attempts: 0,
          score: 0,
          possible: 0,
        };
      }

      studentMap[key].attempts += 1;
      studentMap[key].score += Number(attempt.score) || 0;
      studentMap[key].possible +=
        Number(attempt.totalMarks) || 0;
    });

    const studentRows = Object.values(studentMap)
      .map((item) => ({
        ...item,
        accuracy: percent(item.score, item.possible),
      }))
      .sort((a, b) => b.accuracy - a.accuracy);

    return {
      totalScore,
      totalPossible,
      average,
      quizRows,
      questionRows,
      studentRows,
    };
  }, [attempts]);

  const isStaff =
    role === "faculty" || role === "admin";

  return (
    <div className="sqa-page">
      <style>{styles}</style>

      <div
        className="sqa-row"
        style={{ marginBottom: 8 }}
      >
        <div>
          <h3 className="sqa-title">
            Quiz Centre Performance
          </h3>

          <p className="sqa-muted">
            Insights from submitted quizzes in the separate
            Quiz Centre.
          </p>
        </div>

        <span className="sqa-tag">
          {isStaff ? "Faculty overview" : "My performance"}
        </span>
      </div>

      {loading && (
        <div className="sqa-empty">
          Loading quiz analytics…
        </div>
      )}

      {!loading && !user && (
        <div className="sqa-empty">
          Please sign in to view quiz analytics.
        </div>
      )}

      {error && (
        <div className="sqa-error">{error}</div>
      )}

      {!loading && user && !error && (
        <>
          <div className="sqa-grid">
            <div className="sqa-card">
              <div className="sqa-kicker">
                Quiz attempts
              </div>
              <div className="sqa-value">
                {attempts.length}
              </div>
              <div className="sqa-muted">
                Submitted attempts
              </div>
            </div>

            <div className="sqa-card">
              <div className="sqa-kicker">
                Average accuracy
              </div>
              <div className="sqa-value">
                {analytics.average}%
              </div>
              <div className="sqa-muted">
                Average percentage per attempt
              </div>
            </div>

            <div className="sqa-card">
              <div className="sqa-kicker">
                Marks earned
              </div>
              <div className="sqa-value">
                {analytics.totalScore}
              </div>
              <div className="sqa-muted">
                Out of {analytics.totalPossible} possible marks
              </div>
            </div>

            <div className="sqa-card">
              <div className="sqa-kicker">
                Quizzes attempted
              </div>
              <div className="sqa-value">
                {analytics.quizRows.length}
              </div>
              <div className="sqa-muted">
                Unique quizzes with submissions
              </div>
            </div>
          </div>

          {attempts.length === 0 ? (
            <div className="sqa-empty">
              No Quiz Centre submissions are available yet.
              Complete and submit a quiz to see your
              performance insights.
            </div>
          ) : (
            <>
              <div
                className="sqa-card"
                style={{ marginBottom: 16 }}
              >
                <h3 className="sqa-title">
                  Quiz-wise performance
                </h3>

                {analytics.quizRows.map((item) => (
                  <div
                    key={item.key}
                    style={{ margin: "15px 0" }}
                  >
                    <div
                      className="sqa-row"
                      style={{ marginBottom: 7 }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        {item.title}
                      </strong>

                      <span className="sqa-muted">
                        {item.accuracy}% · {item.attempts} attempt(s)
                      </span>
                    </div>

                    <div className="sqa-bar">
                      <span
                        style={{
                          width: `${item.accuracy}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {analytics.questionRows.length > 0 && (
                <div
                  className="sqa-card"
                  style={{ marginBottom: 16 }}
                >
                  <h3 className="sqa-title">
                    Questions to revisit
                  </h3>

                  <p className="sqa-muted">
                    Questions with the lowest recorded
                    correctness rate. These are question-level
                    indicators, not automatically inferred
                    subject topics.
                  </p>

                  {analytics.questionRows.map(
                    (item, index) => (
                      <div
                        key={`${item.question}-${index}`}
                        style={{
                          padding: "12px 0",
                          borderTop: index
                            ? "1px solid #edf1f4"
                            : 0,
                        }}
                      >
                        <div className="sqa-row">
                          <strong
                            style={{
                              fontSize: 13,
                              flex: 1,
                            }}
                          >
                            {item.question}
                          </strong>

                          <span className="sqa-tag">
                            {item.accuracy}%
                          </span>
                        </div>

                        <p
                          className="sqa-muted"
                          style={{ margin: "5px 0 0" }}
                        >
                          {item.correct} correct out of{" "}
                          {item.total} recorded response(s)
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

              {isStaff && (
                <div
                  className="sqa-card"
                  style={{ marginBottom: 16 }}
                >
                  <h3 className="sqa-title">
                    Student performance
                  </h3>

                  <div className="sqa-table-wrap">
                    <table className="sqa-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Attempts</th>
                          <th>Marks</th>
                          <th>Accuracy</th>
                        </tr>
                      </thead>

                      <tbody>
                        {analytics.studentRows.map(
                          (item) => (
                            <tr key={item.key}>
                              <td>{item.email}</td>
                              <td>{item.attempts}</td>
                              <td>
                                {item.score} / {item.possible}
                              </td>
                              <td>{item.accuracy}%</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="sqa-card">
                <h3 className="sqa-title">
                  Recent submissions
                </h3>

                <div className="sqa-table-wrap">
                  <table className="sqa-table">
                    <thead>
                      <tr>
                        <th>Quiz</th>
                        {isStaff && <th>Student</th>}
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attempts.slice(0, 10).map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.quizTitle || "Untitled quiz"}
                          </td>

                          {isStaff && (
                            <td>
                              {item.studentEmail ||
                                item.studentId}
                            </td>
                          )}

                          <td>
                            {item.score} / {item.totalMarks}
                          </td>

                          <td>
                            {dateLabel(item.submittedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
