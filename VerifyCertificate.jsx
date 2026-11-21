
import { useEffect, useState } from "react";
import "./VerifyCertificate.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://smartlearn-ai-api.onrender.com"
).replace(/\/+$/, "");

function VerifyCertificate({ certificateId }) {
  const [loading, setLoading] = useState(true);
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyCertificate() {
      try {
        setLoading(true);
        setError("");
        setCertificate(null);

        const response = await fetch(
          `${API_URL}/api/certificates/verify/${encodeURIComponent(
            certificateId
          )}`
        );

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (!active) return;

        if (data.valid === true && data.certificate) {
          setCertificate(data.certificate);
        } else {
          setError("This certificate could not be verified.");
        }
      } catch (err) {
        console.error("Certificate verification error:", err);

        if (active) {
          setError(
            "Unable to connect to the verification service. Please try again later."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (certificateId) {
      verifyCertificate();
    } else {
      setError("Certificate ID is missing.");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [certificateId]);

  return (
    <main className="verify-page">
      <div className="verify-card">
        <div className="verify-logo">
          <span>S</span>
          SmartLearn <b>AI</b>
        </div>

        <div className="verify-icon">🎓</div>

        <p className="verify-label">CERTIFICATE VERIFICATION</p>

        <h1>Verify Certificate</h1>

        <p className="verify-description">
          Check the authenticity of a SmartLearn AI certificate.
        </p>

        <div className="verify-id">
          <span>Certificate ID</span>
          <strong>{certificateId || "Not provided"}</strong>
        </div>

        {loading && (
          <div className="verify-loading" role="status">
            Checking certificate...
          </div>
        )}

        {!loading && certificate && (
          <div className="verify-result valid">
            <div className="result-icon">✓</div>
            <h2>Valid Certificate</h2>
            <p>This certificate is verified in SmartLearn AI.</p>

            <div className="verify-details">
              <div>
                <span>Student Name</span>
                <strong>{certificate.studentName}</strong>
              </div>

              <div>
                <span>Course Completed</span>
                <strong>{certificate.courseName}</strong>
              </div>

              <div>
                <span>Completion Date</span>
                <strong>{certificate.completionDate}</strong>
              </div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="verify-result invalid">
            <div className="result-icon">✕</div>
            <h2>
              {error.includes("connect") || error.includes("Server error")
                ? "Verification Unavailable"
                : "Invalid Certificate"}
            </h2>
            <p>{error}</p>
          </div>
        )}

        <a className="verify-home" href="/">
          ← Back to SmartLearn AI
        </a>

        <p className="verify-footer">
          © 2026 SmartLearn AI. Certificate Verification System.
        </p>
      </div>
    </main>
  );
}

export default VerifyCertificate;
