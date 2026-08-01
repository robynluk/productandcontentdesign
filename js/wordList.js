export const INTRO_SENTENCE =
  "im robyn a product and content designer based in seattle lets work together";

// The very first word ("IM") is a 2-letter near-palindrome-risk word — if it
// ever got placed right-to-left or bottom-to-top, reading it left-to-right/
// top-to-bottom would spell "MI" instead. Restrict it to unambiguous forward
// directions only so it's never misreadable.
const FORWARD_ONLY_DIRS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
];

export function buildIntroTokens() {
  return INTRO_SENTENCE.split(/\s+/).map((word, i) => {
    const text = word.toUpperCase().replace(/[^A-Z]/g, "");
    const token = { seq: i, text, display: text };
    if (i === 0) token.allowedDirs = FORWARD_ONLY_DIRS;
    return token;
  });
}

const COMPANIES = [
  { text: "AMAZON", display: "AMAZON" },
  { text: "GOOGLE", display: "GOOGLE" },
  { text: "CVSHEALTH", display: "CVS HEALTH" },
  { text: "MICROSOFT", display: "MICROSOFT" },
  { text: "COSTCO", display: "COSTCO" },
  { text: "DELOITTE", display: "DELOITTE" },
  { text: "THERMOFISHER", display: "THERMO FISHER" },
  { text: "MARRIOTT", display: "MARRIOTT" },
  { text: "ANALOGDEVICES", display: "ANALOG DEVICES" },
];

export function buildCompanyTokens() {
  return COMPANIES.map((c, i) => ({ seq: i, text: c.text, display: c.display }));
}
