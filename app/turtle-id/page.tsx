"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import * as tus from "tus-js-client";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "turtle-id";
const SUPABASE_PROJECT_ID = "obychdtafksanzqlkkcq";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type PhotoStatus = "now" | "later";

function getFileExtension(file: File) {
  return (
    file.name.split(".").pop()?.toLowerCase() ||
    (file.type.startsWith("video/") ? "mp4" : "jpg")
  );
}

export default function TurtleSightingPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [comments, setComments] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = useMemo(() => {
    if (!date || !location.trim() || !email.trim()) return false;
    if (photoStatus === "now" && files.length === 0) return false;
    return true;
  }, [date, location, email, photoStatus, files]);

  async function uploadVideoWithTus(
    file: File,
    filePath: string,
    baseProgress: number,
    progressShare: number
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token || SUPABASE_ANON_KEY;
    if (!token) throw new Error("Missing Supabase upload token.");

    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `https://${SUPABASE_PROJECT_ID}.storage.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${token}`,
          "x-upsert": "false",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: BUCKET_NAME,
          objectName: filePath,
          contentType: file.type || "video/mp4",
          cacheControl: "3600",
        },
        onError: reject,
        onProgress(bytesUploaded, bytesTotal) {
          const fileProgress = bytesTotal ? bytesUploaded / bytesTotal : 0;
          setUploadProgress(
            Math.min(Math.round(baseProgress + fileProgress * progressShare), 99)
          );
        },
        onSuccess() {
          resolve();
        },
      });

      upload
        .findPreviousUploads()
        .then((previousUploads) => {
          if (previousUploads.length > 0) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        })
        .catch(reject);
    });
  }

  async function uploadImage(file: File, filePath: string) {
    let finalFile = file;

    if (file.size > 8 * 1024 * 1024) {
      finalFile = await imageCompression(file, {
        maxSizeMB: 4,
        maxWidthOrHeight: 3500,
        initialQuality: 0.92,
        useWebWorker: true,
      });
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, finalFile, {
        contentType: finalFile.type,
        upsert: false,
      });

    if (error) throw error;
  }

  async function uploadFiles(sightingId: string) {
    const uploadedPaths: string[] = [];
    const progressShare = 100 / files.length;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        throw new Error("Please upload only image or video files.");
      }

      const extension = getFileExtension(file);
      const filePath = `sightings/${sightingId}/${crypto.randomUUID()}.${extension}`;
      const baseProgress = i * progressShare;

      if (isVideo) {
        await uploadVideoWithTus(file, filePath, baseProgress, progressShare);
      } else {
        await uploadImage(file, filePath);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!canSubmit) {
      setErrorMessage(
        "Please enter your email, the date and the location. If you selected upload now, please add at least one photo or video."
      );
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const sightingId = crypto.randomUUID();
      const uploadedPaths =
        photoStatus === "now" ? await uploadFiles(sightingId) : [];

      const { error } = await supabase.from("turtle_sightings").insert([
        {
          id: sightingId,
          email: email.trim().toLowerCase(),
          instagram: instagram.trim() || null,
          observation_date: date,
          observation_time: time || null,
          location: location.trim(),
          comments: comments.trim() || null,
          photo_status: photoStatus,
          file_paths: uploadedPaths,
          upload_completed: uploadedPaths.length > 0,
          identification_status: "pending",
          newsletter_consent: newsletterConsent,
        },
      ]);

      if (error) {
        throw error;
      }

      setUploadProgress(100);
      setUploadComplete(true);
    } catch (error: unknown) {
      console.error("Turtle submission error:", error);

      let message = "Something went wrong. Please try again.";

      if (error instanceof Error) {
        message = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        const possibleMessage = (error as { message?: unknown }).message;

        if (typeof possibleMessage === "string") {
          message = possibleMessage;
        }
      } else if (typeof error === "string") {
        message = error;
      }

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (uploadComplete) {
    return (
      <main className="min-h-screen bg-[#EDE6D8] px-6 py-10 text-[#16305A]">
        <div className="mx-auto w-full max-w-xl text-center">
          <img
            src="/logo.png"
            alt="Great Isles Initiative logo"
            className="mx-auto h-32 w-32 rounded-full object-cover"
          />

          <h1 className="mt-8 text-4xl font-bold">Thank you!</h1>

          {photoStatus === "now" ? (
            <>
              <p className="mt-4 text-lg leading-relaxed">
                Your turtle sighting and photos have been successfully submitted.
              </p>

              <div className="mt-8 rounded-2xl bg-white/70 p-6 text-left">
                <h2 className="text-xl font-bold">What happens next?</h2>

                <div className="mt-5 space-y-5">
                  <div>
                    <p className="font-semibold">1. We review your photos</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#16305A]/75">
                      We check whether the turtle&apos;s facial scale pattern is
                      clearly visible.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold">2. We compare your turtle</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#16305A]/75">
                      Your photos are compared with our growing
                      photo-identification database.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold">
                      3. You receive your identification result
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[#16305A]/75">
                      We&apos;ll email you to let you know whether your turtle
                      matched one of our known individuals or represents a new
                      identification.
                    </p>
                  </div>
                </div>

                <p className="mt-5 rounded-xl bg-[#EDE6D8] p-4 text-sm leading-relaxed">
                  Identification can take a few days depending on the number of
                  submissions.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg leading-relaxed">
                Your turtle sighting has been successfully registered.
              </p>

              <div className="mt-8 rounded-2xl bg-white/70 p-6 text-left">
                <h2 className="text-xl font-bold">Upload your photos later</h2>

                <p className="mt-3 leading-relaxed">
                  Once you have transferred the photos from your camera, use the
                  personal upload link sent to your email.
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#16305A]/75">
                  After we receive your photos, we&apos;ll compare the turtle with
                  our database and email you the identification result.
                </p>
              </div>
            </>
          )}

          <div className="mt-6 rounded-2xl bg-[#16305A] p-6 text-white shadow-lg">
            <h2 className="text-2xl font-bold">Want to support the project?</h2>

            <p className="mt-3 leading-relaxed text-white/90">
              Every submitted photo helps us identify sea turtles. A symbolic
              adoption helps us continue monitoring and protecting them.
            </p>

            <a
              href="https://www.great-isles-initiative.org/adopt-a-turtle/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-6 py-4 font-semibold text-[#16305A] transition hover:opacity-90"
            >
              Browse turtles to adopt
            </a>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-xl border-2 border-[#16305A] px-6 py-4 font-semibold transition hover:bg-[#16305A]/5"
          >
            Report another sighting
          </button>

          <Link
            href="/"
            className="mt-5 inline-block text-sm font-semibold underline"
          >
            Return to the start page
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#EDE6D8] px-6 py-10 text-[#16305A]">
      <style jsx global>{`
        input[type="date"],
        input[type="time"] {
          color: #16305a !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #16305a !important;
          color-scheme: light;
        }
      `}</style>

      {isSubmitting && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16305A]/95 px-4">
  <div className="w-full max-w-md rounded-3xl bg-[#EDE6D8] p-8 text-center shadow-2xl">
    <img
      src="/logo.png"
      alt="Great Isles Initiative logo"
      className="mx-auto h-28 w-28 rounded-full object-cover"
    />

    <h2 className="mt-6 text-2xl font-bold text-[#16305A]">
      {photoStatus === "now"
        ? "Uploading your observation..."
        : "Registering your observation..."}
    </h2>

    <div className="mt-6 h-3 overflow-hidden rounded-full bg-white">
      <div
        className="h-full rounded-full bg-[#16305A] transition-all"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>

    {photoStatus === "now" && (
      <p className="mt-3 font-semibold text-[#16305A]">
        {uploadProgress}%
      </p>
    )}

    <p className="mt-3 text-sm text-[#16305A]/70">
      Please keep this page open.
    </p>
  </div>
</div>
      )}

      <div className="mx-auto max-w-xl">
        <Link href="/" className="underline">← Back</Link>

        <h1 className="mt-8 text-4xl font-bold">Report a Turtle Sighting</h1>

        <p className="mt-3 text-lg leading-relaxed">
          Tell us where and when you saw the turtle. Upload your photos now or register first and add them later.
        </p>

        <p className="mt-3 leading-relaxed">
          Every turtle has a unique facial scale pattern. Your photos can help us identify individual turtles and follow their story over time.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div className="rounded-2xl bg-white/70 p-5">
            <h2 className="text-lg font-semibold">Do you have your photos ready?</h2>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4 leading-relaxed">
              <input
                type="radio"
                name="photoStatus"
                checked={photoStatus === "now"}
                onChange={() => setPhotoStatus("now")}
                className="mt-1"
              />
              <span>
                <strong>Yes, upload them now</strong>
                <span className="mt-1 block text-sm text-[#16305A]/70">
                  Add one or more photos or videos below.
                </span>
              </span>
            </label>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4 leading-relaxed">
              <input
                type="radio"
                name="photoStatus"
                checked={photoStatus === "later"}
                onChange={() => {
                  setPhotoStatus("later");
                  setFiles([]);
                }}
                className="mt-1"
              />
              <span>
                <strong>No, they are still on my camera</strong>
                <span className="mt-1 block text-sm text-[#16305A]/70">
                  Register now and upload them later using your email link.
                </span>
              </span>
            </label>
          </div>

          {photoStatus === "now" && (
            <>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  const selectedFiles = event.currentTarget.files
                    ? Array.from(event.currentTarget.files)
                    : [];
                  setFiles(selectedFiles);
                }}
                className="rounded-xl bg-white p-4"
              />

              {files.length > 0 && (
                <div className="rounded-xl bg-white p-4 text-sm">
                  {files.length} file{files.length === 1 ? "" : "s"} selected
                </div>
              )}
            </>
          )}

          <div className="rounded-2xl bg-white/70 p-5">
            <label className="text-sm font-semibold">Date and time of observation</label>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="min-h-[56px] rounded-xl bg-white p-4 text-base font-semibold"
              />

              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="min-h-[56px] rounded-xl bg-white p-4 text-base font-semibold"
              />
            </div>
          </div>

          <input
            type="text"
            required
            placeholder="Location or dive site"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="rounded-xl bg-white p-4 placeholder:text-[#16305A]"
          />

          <textarea
            placeholder="Special observations or unusual features (optional)"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            className="min-h-32 rounded-xl bg-white p-4 placeholder:text-[#16305A]"
          />

          <div className="rounded-2xl bg-white/70 p-5">
  {photoStatus === "now" ? (
    <>
      <h2 className="text-lg font-semibold">
        🐢 Get an update on your turtle
      </h2>

      <p className="mt-2 text-sm leading-relaxed">
        Enter your email so we can tell you whether your turtle was identified
        and which individual you encountered.
      </p>

      <input
        type="email"
        required
        placeholder="Email for your identification update"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-4 w-full rounded-xl bg-white p-4 placeholder:text-[#16305A]"
      />
    </>
  ) : (
    <>
      <h2 className="text-lg font-semibold">
        📸 We'll remind you to upload your photos
      </h2>

      <p className="mt-2 text-sm leading-relaxed">
        No problem if your photos are still on your camera. Enter your email
        below and we'll send you a reminder in a few days, once you've had time
        to transfer your photos.
      </p>

      <input
        type="email"
        required
        placeholder="Email for your upload reminder"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-4 w-full rounded-xl bg-white p-4 placeholder:text-[#16305A]"
      />
    </>
  )}

  <input
    type="text"
    placeholder="Instagram handle (optional)"
    value={instagram}
    onChange={(event) => setInstagram(event.target.value)}
    className="mt-4 w-full rounded-xl bg-white p-4 placeholder:text-[#16305A]"
  />

  <label className="mt-4 flex items-start gap-3 rounded-xl bg-white p-4">
    <input
      type="checkbox"
      checked={newsletterConsent}
      onChange={(event) => setNewsletterConsent(event.target.checked)}
      className="mt-1"
    />
    <span className="text-sm leading-relaxed">
      I would also like to receive occasional updates about sea turtle
      conservation and the Great Isles Initiative.
    </span>
  </label>
</div>

          {errorMessage && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="mt-4 rounded-2xl bg-[#16305A] py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {photoStatus === "now" ? "Submit Turtle Sighting" : "Register Turtle Sighting"}
          </button>

          <p className="pb-8 text-center text-xs leading-relaxed text-[#16305A]/60">
            By submitting this form, you agree that the Great Isles Initiative may use the sighting data and uploaded media for sea turtle research and conservation.
          </p>
        </form>
      </div>
    </main>
  );
}
