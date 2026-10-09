// Obviously fake credentials, assembled at runtime so no secret-shaped strings live in the repo.
const r = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);

export const FAKE = {
  openai: "sk-" + "proj-" + r("FAKEkey0123", 40),
  aws: "AK" + "IA" + r("FAKE0EXAMPLE", 16),
  github: "gh" + "p_" + r("FAKEtoken9", 36),
  google: "AI" + "za" + r("FAKEgoogle7", 35),
  jwt: "ey" + "JhbGciOiJIUzI1NiJ9" + "." + "ey" + "JzdWIiOiJmYWtlIn0" + "." + r("FAKEsig42", 20),
  generic: r("Xq7FAKEr9Lm2Zt", 32),
};

export const SAMPLE = `Hi, I'm Priya Sharma (priya.sharma@example.com, +91 98765 43210).
Our backend is failing. Logs from 192.168.1.24:

  OPENAI_API_KEY=${FAKE.openai}
  aws key ${FAKE.aws}
  db: postgres://admin:hunter2pass@db.internal.example.com:5432/app

Customer card 4111 1111 1111 1111 was charged twice. PAN ABCDE1234F,
Aadhaar 2345 6789 0123. Office: 221 Baker Street, PIN 560001.

Can you tell me why priya.sharma@example.com never got the receipt?`;
