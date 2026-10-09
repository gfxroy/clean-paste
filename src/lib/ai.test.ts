import { toSpans } from "./ai";

it("turns BIO wordpiece tags into word spans", () => {
  const text = "my name is Rahul Sharma, from Delhi";
  const tokens = ["my", "name", "is", "ra", "##hul", "sharma", ",", "from", "delhi"];
  const tags = [
    { entity: "B-PERSON", score: 0.99, index: 4 },
    { entity: "I-PERSON", score: 0.99, index: 5 },
    { entity: "I-PERSON", score: 0.99, index: 6 },
    { entity: "B-LOCATION", score: 0.9, index: 9 },
  ];
  expect(toSpans(text, tokens, tags).map((s) => [s.tag, s.value])).toEqual([
    ["NAME", "Rahul Sharma"],
    ["ADDRESS", "Delhi"],
  ]);
});
