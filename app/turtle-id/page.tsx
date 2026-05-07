"use client";

import { useState } from "react";
import Link from "next/link";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "turtle-id";
const CONCURRENT_UPLOADS = 2;

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

  async function handleSubmit() {
    if (files.length === 0) {
      alert("Please choose at least one turtle photo.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let completedUploads = 0;
      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i += CONCURRENT_UPLOADS) {
        const batch = files.slice(i, i + CONCURRENT_UPLOADS);

        const batchPaths = await Promise.all(
          batch.map(async (selectedFile) => {
            let finalFile = selectedFile;

            if (selectedFile.size > 8 * 1024 * 1024) {
              finalFile = await imageCompression(selectedFile, {
                maxSizeMB: 4,
                maxWidthOrHeight: 3500,
                initialQuality: 0.95,
                useWebWorker: true,
              });
            }

            const fileExt = finalFile.name.split(".").pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(filePath, finalFile, {
                contentType: finalFile.type,
                upsert: false,
              });

            if (uploadError) {
              console.error("Upload error:", uploadError);
              throw uploadError;
            }

            completedUploads += 1;

            setUploadProgress(
              Math.round((completedUploads / files.length) * 100)
            );

            return filePath;
          })
        );

        uploadedPaths.push(...batchPaths);
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

      setFiles([]);
      setDate("");
      setTime("");
      setLocation("");
      setBehavior("");
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
    <main className="min-h-screen bg-[#EDE6D8] p-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-[#16305A] underline">
          ← Back
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-[#16305A]">Turtle ID</h1>

        <p className="mt-3 text-[#16305A]">
          Upload one or more turtle photos and add a few details about your
          observation. Please make one upload per individual turtle. If you add
          many photos, it may take a little longer — hang tight, the turtle is
          worth it.
        </p>

        <form className="mt-8 flex flex-col gap-5">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="rounded-xl bg-white p-4 text-[#16305A]"
          />

          {files.length > 0 && (
            <div className="rounded-xl bg-white p-4 text-sm text-[#16305A]">
              {files.length} photo{files.length > 1 ? "s" : ""} selected
            </div>
          )}

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
              : "Upload Turtle Photos"}
          </button>
        </form>
      </div>
    </main>
  );
}