
import { useEffect, useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

function FirebaseTest() {
  const [status, setStatus] = useState("Checking Firebase connection...");

  useEffect(() => {
    async function testFirebase() {
      try {
        const testCollection = collection(db, "connection_tests");

        await addDoc(testCollection, {
          message: "SmartLearn AI Firebase connection successful",
          createdAt: new Date().toISOString(),
        });

        const snapshot = await getDocs(testCollection);

        setStatus(
          `Firebase connected successfully! Documents: ${snapshot.size}`
        );
      } catch (error) {
        console.error("Firebase error:", error);
        setStatus("Connection failed: " + error.message);
      }
    }

    testFirebase();
  }, []);

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h2>SmartLearn AI Firebase Test</h2>
      <p>{status}</p>
    </div>
  );
}

export default FirebaseTest;
