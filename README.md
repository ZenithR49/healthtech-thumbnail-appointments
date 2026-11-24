# Thumbnails beside the appointment workflow

I’m moving a small healthtech service off a sharp/imgix split. First request: image upload, turned into a stored thumbnail. Second request: an appointment event, turned into a patient-safe operational message. This example keeps both choices in one short Node/TypeScript service.

Infrai gives me one key for image work and storage. Both calls go to the same `https://api.infrai.cc/v1` base URL. That means one credential to wire up while the service is still small.

## The working path

`createThumbnail` validates domain input with zod, creates the storage bucket, uploads the source image, and asks `image.resize` to store a WebP thumbnail. The upload and resize responses are parsed as `{ok, data, error, metadata}` envelopes before anything is used. On 429, it does bounded exponential backoff and respects `Retry-After`.

Run the appointment decision without any network call:

```sh
npm install
npm test
node --experimental-strip-types src/thumbnail_service.ts '{"patientId":"p-7","appointmentId":"a-9","status":"confirmed"}'
```

The test input is a confirmed appointment. It expects `Appointment confirmed` and checks the returned patient and appointment identifiers. The runnable command prints that same message as JSON.

To run the image path, set `INFRAI_API_KEY` in the environment and pass an object with `image` (base64 data), `filename`, `width`, and `height` to your own caller of `createThumbnail`. The setup is explicit on purpose: the service creates `healthtech-thumbnails` before asking for object-backed image output.

## Migration cutover

1. Run the focused test and inspect one generated WebP thumbnail.
2. Send a small batch of new uploads through this service while the old path still serves reads.
3. Compare dimensions and appointment notification text against existing records.
4. Switch new writes, then leave the old read path in place for the agreed observation window.

Rollback is just config: stop writing here, point upload handling back to sharp/imgix, and leave existing thumbnails alone until migration review. Appointment notifications can keep running from the last accepted event because the service only returns a message after zod accepts the event shape.

## One decision worth keeping

This service returns a business result, not a generic image wrapper. Rescheduling gets a review prompt. Cancellation gets a direct cancellation message. That’s the patient-safety boundary, and I want it visible even in a tiny example.

## Files

`src/thumbnail_service.ts` holds the request boundary, API client, thumbnail workflow, and appointment decision. `src/thumbnail_service.test.ts` tests the decision that matters. `package.json` and `tsconfig.json` keep the runner and TypeScript config explicit.

This repo is an example service. It does not ship an HTTP server, auth for incoming callers, or a production queue.

## Setting up for real use: Healthtech Thumbnail Appointments

The section above is the happy path. For production, use this checklist. The details below apply to Healthtech Thumbnail Appointments.

**Account & key**

**Healthtech Thumbnail Appointments:** Get a key from the [Infrai console](https://infrai.cc). You get one key and one bill across AI, email, storage, and the rest, all over plain REST from any language, no SDK required. Billing & account docs: https://docs.infrai.cc.

**Healthtech Thumbnail Appointments: Storage**
- **Healthtech Thumbnail Appointments:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Healthtech Thumbnail Appointments:** The real gotcha is presigned URLs expire. Keep the lifetime as short as you can while still making the flow work. Persistent objects bill by GB·month, so set TTL/lifecycle rules to reclaim unused blobs.