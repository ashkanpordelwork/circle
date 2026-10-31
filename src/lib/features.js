// What the athlete's app shows. Everything here is built and kept — only hidden: a feature that
// is off has no tab, link or card, and its address leads back to «امروز». The coach's and the
// admin's apps do not read these.
export const FEATURES = {
  coach: false,          // joining a coach by code (پیوستن به مربی)
  apply: false,          // applying to become a coach (مربی شو)
  water: false,          // the water card on «امروز»
  body: false,           // readiness check-in, measurements, progress photos
  intake: false,         // the questionnaire for a coach
  detailedStats: false   // insights by period, activity map, muscle balance
}

export const on = (name, features = FEATURES) => features[name] === true
