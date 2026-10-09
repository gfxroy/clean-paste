import { clean, detect, luhn, restore, summary } from "./detect";
import { FAKE, SAMPLE } from "./fixtures";

const tags = (t: string) => detect(t).map((f) => f.tag);

describe("detectors", () => {
  it("finds emails and Indian / US phones", () => {
    expect(tags("mail a.b@example.com")).toEqual(["EMAIL"]);
    expect(tags("call +91 98765 43210")).toEqual(["PHONE"]);
    expect(tags("call +919876543210")).toEqual(["PHONE"]);
    expect(tags("call (415) 555-0132")).toEqual(["PHONE"]);
  });

  it("only flags Luhn-valid cards", () => {
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(tags("card 4111 1111 1111 1111")).toEqual(["CARD"]);
    expect(tags("order 4111 1111 1111 1112")).toEqual([]);
  });

  it("finds API keys and tokens", () => {
    for (const k of Object.values(FAKE)) expect(tags(`x ${k} y`)).toEqual(["KEY"]);
    expect(detect("password: correcthorse")[0].value).toBe("correcthorse");
  });

  it("finds IDs, IPs, private URLs and addresses", () => {
    expect(tags("PAN ABCDE1234F")).toEqual(["PAN"]);
    expect(tags("Aadhaar 2345 6789 0123")).toEqual(["AADHAAR"]);
    expect(tags("SSN 123-45-6789")).toEqual(["SSN"]);
    expect(tags("host 10.0.0.1")).toEqual(["IP"]);
    expect(tags("see https://x.example.com/a?token=abc")).toEqual(["URL"]);
    expect(tags("see https://example.com/docs")).toEqual([]);
    expect(tags("at 221 Baker Street")).toEqual(["ADDRESS"]);
  });

  it("leaves ordinary prose alone", () => {
    expect(detect("Version 2.0 ships in 2026 with 3 new features.")).toEqual([]);
  });
});

describe("clean + restore", () => {
  it("numbers placeholders consistently and round-trips", () => {
    const r = clean("a@x.com b@y.com a@x.com");
    expect(r.text).toBe("[EMAIL_1] [EMAIL_2] [EMAIL_1]");
    expect(summary(r.counts)).toBe("Removed 2 emails");
    expect(restore("Reply to [EMAIL_2] and EMAIL_1.", r.map)).toBe("Reply to b@y.com and a@x.com.");
  });

  it("cleans the sample fully", () => {
    const r = clean(SAMPLE);
    expect(r.text).not.toContain("@example.com");
    expect(r.text).not.toContain(FAKE.openai);
    expect(restore(r.text, r.map)).toBe(SAMPLE);
  });
});
