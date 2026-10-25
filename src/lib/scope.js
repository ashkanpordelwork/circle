// Who the signed-in person's own screens are about. Set once the role is known (App.jsx).
// Every coach and student query filters by these: the database already limits what each person
// reaches, but an admin reaches everyone, and their own coach or student screens must still show
// only their own people.
export const scope = { uid: null, student: null }
export const setScope = (uid, student) => { scope.uid = uid; scope.student = student }
