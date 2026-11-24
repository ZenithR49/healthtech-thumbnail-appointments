import assert from "node:assert/strict";
import { notificationFor, parseAppointment } from "./thumbnail_service.ts";

assert.equal(notificationFor("rescheduled"), "Appointment time changed; please review the new time");
assert.deepEqual(parseAppointment({ patientId: "p-7", appointmentId: "a-9", status: "confirmed" }), {
  patientId: "p-7", appointmentId: "a-9", message: "Appointment confirmed"
});
console.log("appointment decision test passed");
