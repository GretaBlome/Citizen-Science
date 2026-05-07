"use client";

import { useState } from "react";
import Link from "next/link";
import * as tus from "tus-js-client";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "reef-monitoring";
const SUPABASE_PROJECT_ID = "obychdtafksanzqlkkcq";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function ReefMonitoringPage() {
  const [file, setFile] = useState<File | null>(null);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [camera, setCamera] = useState("");
  const [comments, setComments] = useState("");

  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);

  async function uploadVideoWithTus(file: File, filePath: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token || SUPABASE_ANON_KEY;

    if (!token) {
      throw new Error("Missing Supabase token.");
    }

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

        onError(error) {
          console.error("TUS upload failed:", error);
          reject(error);
        },

        onProgress(bytesUploaded, bytesTotal) {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(percentage);
        },

        onSuccess() {
          resolve();
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        upload.start();
      });
    });
  }

  async function handleSubmit() {
    if (!file) {
      alert("Please choose a video first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      await uploadVideoWithTus(file, filePath);

      const { error: insertError } = await supabase
        .from("citizen_uploads")
        .insert([
          {
            project: "reef-monitoring",
            location,
            camera,
            comments,
            file_path: filePath,
            file_type: file.type,
            dive_date: date || null,
            dive_time: time || null,
            email: email || null,
            instagram: instagram || null,
          },
        ]);

      if (insertError) {
        throw insertError;
      }

      setFile(null);
      setDate("");
      setTime("");
      setLocation("");
      setCamera("");
      setComments("");
      setEmail("");
      setInstagram("");
      setUploadProgress(0);
      setUploadComplete(true);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  if (uploadComplete) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EDE6D8] px-6 py-12">
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Great Isles Initiative logo"
            className="h-64 w-64 rounded-full object-cover"
          />

          <h1 className="mt-12 text-5xl font-bold tracking-tight text-[#16305A] md:text-6xl">
            Upload successful
          </h1>

          <p className="mt-8 max-w-xl text-xl leading-relaxed text-[#16305A] md:text-2xl">
            Thank you for contributing to reef monitoring and marine
            conservation.
          </p>

          <p className="mt-8 max-w-xl text-xl font-semibold leading-relaxed text-[#16305A] md:text-2xl">
            Stay connected with the Great Isles citizen science community.
          </p>

          <div className="mt-10 flex w-full max-w-md flex-col gap-5">
            <a
              href="https://instagram.com/greatislesinitiative"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-[#16305A] px-8 py-5 text-lg font-semibold text-white shadow-lg transition hover:scale-[1.02]"
            >
              Follow us on Instagram
            </a>

            <button
              type="button"
              onClick={() => setUploadComplete(false)}
              className="rounded-2xl border-2 border-[#16305A] px-8 py-5 text-lg font-semibold text-[#16305A] transition hover:bg-[#16305A]/5"
            >
              Upload another video
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EDE6D8] p-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-[#16305A] underline">
          ← Back
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-[#16305A]">
          Reef Monitoring
        </h1>

        <p className="mt-3 text-[#16305A]">
          Upload your reef monitoring video and add a few details about the dive.
        </p>

        <form className="mt-8 flex flex-col gap-5">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-xl bg-white p-4 text-[#16305A]"
          />

          {isUploading && (
            <div className="rounded-xl bg-white p-4">
              <p className="text-sm font-semibold text-[#16305A]">
                Uploading: {uploadProgress}%
              </p>

              <div className="mt-2 h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-[#16305A]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

<input
  type="text"
  inputMode="numeric"
  placeholder="Date (DD.MM.YYYY)"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  className="rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
/>

<input
  type="text"
  inputMode="numeric"
  placeholder="Time (HH:MM)"
  value={time}
  onChange={(e) => setTime(e.target.value)}
  className="rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
/>

          <input
            type="text"
            placeholder="Location / reef name"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl bg-white p-4 text-[#16305A]"
          />

          <input
            type="text"
            placeholder="Camera used"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
            className="rounded-xl bg-white p-4 text-[#16305A]"
          />

          <textarea
            placeholder="Add comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="min-h-32 rounded-xl bg-white p-4 text-[#16305A]"
          />

          <div className="rounded-2xl bg-white/70 p-5">
            <h2 className="text-lg font-semibold text-[#16305A]">
              Join the citizen science community (optional)
            </h2>

            <p className="mt-2 text-sm text-[#16305A]">
              Leave your email address or Instagram handle if you would like to
              receive updates, connect with the community, or hear more about
              the project.
            </p>

            <input
              type="email"
              placeholder="Email address (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-4 w-full rounded-xl bg-white p-4 text-[#16305A]"
            />

            <input
              type="text"
              placeholder="Instagram handle (optional)"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="mt-4 w-full rounded-xl bg-white p-4 text-[#16305A]"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading}
            className="mt-4 rounded-2xl bg-[#16305A] py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {isUploading ? `Uploading ${uploadProgress}%` : "Upload"}
          </button>
        </form>
      </div>
    </main>
  );
}