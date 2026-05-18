"use client";

import { useState } from "react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import * as tus from "tus-js-client";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "turtle-id";
const SUPABASE_PROJECT_ID = "obychdtafksanzqlkkcq";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CONCURRENT_UPLOADS = 2;
const MIN_UPLOAD_SCREEN_TIME = 10000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function TurtleIdPage() {
  const [files, setFiles] = useState<File[]>([]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [behavior, setBehavior] = useState("");
  const [comments, setComments] = useState("");

  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);

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
          const fileProgress = bytesUploaded / bytesTotal;
          const totalProgress = Math.round(
            baseProgress + fileProgress * progressShare
          );

          setUploadProgress(Math.min(totalProgress, 99));
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

  async function uploadImageNormally(file: File, filePath: string) {
    let finalFile = file;

    if (file.size > 8 * 1024 * 1024) {
      finalFile = await imageCompression(file, {
        maxSizeMB: 4,
        maxWidthOrHeight: 3500,
        initialQuality: 0.95,
        useWebWorker: true,
      });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, finalFile, {
        contentType: finalFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Image upload error:", uploadError);
      throw uploadError;
    }
  }

  async function handleSubmit() {
    if (files.length === 0) {
      alert("Please choose at least one turtle photo or video.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const uploadScreenStartedAt = Date.now();

    try {
      const uploadedPaths: string[] = [];
      const progressShare = 100 / files.length;

      for (let i = 0; i < files.length; i++) {
        const selectedFile = files[i];

        const isImage = selectedFile.type.startsWith("image/");
        const isVideo = selectedFile.type.startsWith("video/");

        if (!isImage && !isVideo) {
          throw new Error("Please upload only image or video files.");
        }

        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const baseProgress = i * progressShare;

        if (isVideo) {
          await uploadVideoWithTus(
            selectedFile,
            filePath,
            baseProgress,
            progressShare
          );
        }

        if (isImage) {
          await uploadImageNormally(selectedFile, filePath);

          setUploadProgress(
            Math.round(((i + 1) / files.length) * 100)
          );
        }

        uploadedPaths.push(filePath);
      }

      const { error: insertError } = await supabase
        .from("citizen_uploads")
        .insert([
          {
            project: "turtle-id",
            location,
            behavior,
            comments,
            file_path: uploadedPaths[0],
            file_paths: uploadedPaths,
            file_type: files[0].type,
            observation_date: date || null,
            observation_time: time || null,
            email: email || null,
            instagram: instagram || null,
          },
        ]);

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        alert(JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      const elapsed = Date.now() - uploadScreenStartedAt;
      const remainingTime = Math.max(0, MIN_UPLOAD_SCREEN_TIME - elapsed);

      if (remainingTime > 0) {
        await wait(remainingTime);
      }

      setUploadProgress(100);

      setFiles([]);
      setDate("");
      setTime("");
      setLocation("");
      setBehavior("");
      setComments("");
      setEmail("");
      setInstagram("");
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
            Thank you for contributing to turtle identification and marine
            conservation.
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
              Upload another turtle observation
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-[#EDE6D8] p-8">
      <style jsx global>{`
        input[type="date"],
        input[type="time"] {
          color: #16305a !important;
          background-color: #ffffff !important;
          -webkit-text-fill-color: #16305a !important;
          opacity: 1 !important;
          color-scheme: light;
          appearance: none;
          -webkit-appearance: none;
        }

        input[type="date"]::-webkit-date-and-time-value,
        input[type="time"]::-webkit-date-and-time-value {
          color: #16305a !important;
          text-align: left;
        }

        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 1;
          filter: invert(18%) sepia(28%) saturate(1571%) hue-rotate(181deg)
            brightness(87%) contrast(91%);
        }
      `}</style>

      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16305A]/95 px-3 py-4">
          <div className="flex max-h-[96vh] w-full max-w-md flex-col rounded-[2rem] bg-[#EDE6D8] p-3 text-center shadow-2xl md:max-w-lg">
            <video
              src="/turtle-analysis.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="max-h-[72vh] w-full rounded-3xl object-contain"
            />

            <div className="mt-4">
              <div className="h-3 w-full rounded-full bg-white">
                <div
                  className="h-3 rounded-full bg-[#16305A] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              <p className="mt-3 text-sm font-semibold text-[#16305A]">
                Uploading observation {uploadProgress}%
              </p>

              <p className="mt-2 text-xs text-[#16305A]/70">
                Please keep this page open. Videos may take a little longer.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-[#16305A] underline">
          ← Back
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-[#16305A]">Turtle ID</h1>

        <p className="mt-3 text-[#16305A]">
          Upload one or more turtle photos or videos and add a few details about
          your observation. Please make one upload per individual turtle. If you
          add many files or videos, it may take a little longer — hang tight, the
          turtle is worth it.
        </p>

        <form className="mt-8 flex flex-col gap-5">
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="rounded-xl bg-white p-4 text-[#16305A]"
          />

          {files.length > 0 && (
            <div className="rounded-xl bg-white p-4 text-sm text-[#16305A]">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </div>
          )}

          <div className="rounded-2xl bg-white/70 p-5">
            <label className="text-sm font-semibold text-[#16305A]">
              Date and time of observation
            </label>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-[56px] rounded-xl bg-white p-4 text-base font-semibold text-[#16305A]"
              />

              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-[56px] rounded-xl bg-white p-4 text-base font-semibold text-[#16305A]"
              />
            </div>

            <p className="mt-2 text-xs text-[#16305A]/70">
              Tap the fields to open your phone’s calendar and time picker.
            </p>
          </div>

          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
          />

          <input
            type="text"
            placeholder="Behavior of the turtle"
            value={behavior}
            onChange={(e) => setBehavior(e.target.value)}
            className="rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
          />

          <textarea
            placeholder="Special observations or unusual features"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="min-h-32 rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
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
              className="mt-4 w-full rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
            />

            <input
              type="text"
              placeholder="Instagram handle (optional)"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="mt-4 w-full rounded-xl bg-white p-4 text-[#16305A] placeholder:text-[#16305A]"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading}
            className="mt-4 rounded-2xl bg-[#16305A] py-5 text-lg font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {isUploading
              ? `Uploading ${uploadProgress}%`
              : "Upload Turtle Files"}
          </button>
        </form>
      </div>
    </main>
  );
}