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

  it("hides labeled secrets but keeps the label", () => {
    const user = "key=sadasdasdddaaa theaaditya@gmail.com pass=sfasfasfs";
    expect(clean(user).text).toBe("key=[KEY_1] [EMAIL_1] pass=[PASSWORD_1]");
    expect(summary(clean(user).counts)).toBe("Removed 1 key, 1 email, 1 password");
    const cases: [string, string][] = [
      ["password is hunter2", "password is [PASSWORD_1]"],
      ["Password - abc123", "Password - [PASSWORD_1]"],
      ["key: xyz", "key: [KEY_1]"],
      ['{"password": "x"}', '{"password": "[PASSWORD_1]"}'],
      ["DB_PASSWORD=x", "DB_PASSWORD=[PASSWORD_1]"],
      ["/cb?token=x&a=1", "/cb?token=[KEY_1]&a=1"],
      ["pin: 4821, otp=991", "pin: [PASSWORD_1], otp=[PASSWORD_2]"],
      ["x-api-key: q1w2 secret – s3cr3t", "x-api-key: [KEY_1] secret – [KEY_2]"],
      ["Authorization: Bearer abcdefgh123", "Authorization: Bearer [KEY_1]"],
    ];
    for (const [i, o] of cases) expect(clean(i).text).toBe(o);
    const r = clean("pwd=p@ss");
    expect(restore("use [PASSWORD_1]", r.map)).toBe("use p@ss");
  });

  it("understands free-form labels", () => {
    const cases: [string, string][] = [
      ["card number - 4111 1111 1111 1111", "card number - [CARD_1]"],
      ["my card no is 4111-1111-1111-1111", "my card no is [CARD_1]"],
      ["card : 4111111111111111", "card : [CARD_1]"],
      ["card no 1234 5678 9012 3456", "card no [CARD_1]"],
      ["password - hunter2", "password - [PASSWORD_1]"],
      ["my password is hunter", "my password is [PASSWORD_1]"],
      ["my pin 4821", "my pin [PASSWORD_1]"],
      ["aadhaar 1234 5678 9012", "aadhaar [AADHAAR_1]"],
      ["call me at 98765 43210", "call me at [PHONE_1]"],
      ["reach me on 987 654 3210 anytime", "reach me on [PHONE_1] anytime"],
      ["cvv is 123, expiry 08/27", "cvv is [CVV_1], expiry [EXPIRY_1]"],
      ["pay to rahul@okaxis, IFSC HDFC0001234, acc no 123456789012", "pay to [UPI_1], IFSC [IFSC_1], acc no [ACCOUNT_1]"],
      ["my name is Rahul Sharma and I live in Saket, Delhi", "my name is [NAME_1] and I live in [ADDRESS_1]"],
      ["token=a1B2c3D4e5F6g7H8", "token=[KEY_1]"],
    ];
    for (const [i, o] of cases) expect(clean(i).text).toBe(o);
  });

  it("does not flag normal sentences, years or prices", () => {
    for (const t of [
      "In 2024 we paid ₹4,999 and $1,299.99 for 3 laptops.",
      "The password policy changed last year.",
      "Call the team on Monday about the card design.",
      "Order total was 12500 rupees on 12/05/2025.",
      "My account is fine, thanks. Number of users: 42.",
      "Version 1.2.3 is out. See page 404 for details.",
    ])
      expect(detect(t)).toEqual([]);
  });

  it("ignores words that merely contain a label", () => {
    for (const t of ["keyboard: mechanical", "passage - long", "tokenize: words", "the key is practice", "monkey=1", "pin the map"])
      expect(detect(t)).toEqual([]);
  });

  it("finds IDs, IPs, private URLs and addresses", () => {
    expect(tags("PAN ABCDE1234F")).toEqual(["PAN"]);
    expect(tags("Aadhaar 2345 6789 0123")).toEqual(["AADHAAR"]);
    expect(tags("SSN 123-45-6789")).toEqual(["SSN"]);
    expect(tags("host 10.0.0.1")).toEqual(["IP"]);
    expect(tags("see https://x.example.com/a?sig=abc")).toEqual(["URL"]);
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
