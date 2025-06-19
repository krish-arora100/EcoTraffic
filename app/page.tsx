import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main} style={{ maxWidth: 700, margin: "2rem auto", fontFamily: "sans-serif" }}>
        <h1>EcoTraffic</h1>
        <h2 style={{ color: '#2e7d32' }}>Fostering climate optimism through accessible, data-driven technology</h2>
        <p>
          Welcome to EcoTraffic! Explore California's transportation emissions data with interactive maps, dynamic graphs, and an AI-powered chatbot. Our mission is to make climate progress visible and actionable for everyone.
        </p>
        <h3>Key Features</h3>
        <ul>
          <li>
            <b>Interactive California Emissions Map:</b> Visualize GHG emissions by county, color-coded for easy comparison. Filter by county, vehicle type, and year. <br/>
            <Link href="/map">Go to Map &rarr;</Link>
          </li>
          <li>
            <b>Dynamic Graphs & Trends:</b> Explore emissions trends over time and compare across counties and vehicle types. <br/>
            <Link href="/graphs">Go to Graphs &rarr;</Link>
          </li>
          <li>
            <b>AI Chatbot:</b> Ask questions about the data and get instant, smart answers powered by OpenAI and Pinecone. <br/>
            <Link href="/chatbot">Go to Chatbot &rarr;</Link>
          </li>
          <li>
            <b>Data Accessibility:</b> No downloads or preprocessing needed—everything is interactive and ready to explore.
          </li>
          <li>
            <b>Climate Optimism:</b> See positive trends and insights that highlight progress and encourage action.
          </li>
        </ul>
        <p style={{ marginTop: 40, color: '#888' }}>
          &copy; 2025 EcoTraffic
        </p>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
