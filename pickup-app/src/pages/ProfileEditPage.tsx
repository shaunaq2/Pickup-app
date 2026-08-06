import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import Avatar from "../components/Avatar";

interface Props {
  username: string;
  onBack: () => void;
  onUsernameChange: (newUsername: string) => void;
}

export default function ProfileEditPage({ username, onBack, onUsernameChange }: Props) {
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null);
  const [newUsername, setNewUsername]   = useState(username);
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [success, setSuccess]           = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const debounceRef                     = useRef<NodeJS.Timeout>();

  // Load existing profile
  useEffect(() => {
    supabase.from("user_profiles").select("avatar_url")
      .eq("username", username).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatarUrl(data.avatar_url); });
  }, [username]);

  // Check username availability with debounce
  useEffect(() => {
    if (newUsername === username) { setNameAvailable(null); return; }
    if (!newUsername.trim() || newUsername.length < 3) { setNameAvailable(null); return; }

    clearTimeout(debounceRef.current);
    setCheckingName(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from("users")
        .select("username").eq("username", newUsername.trim()).maybeSingle();
      setNameAvailable(!data);
      setCheckingName(false);
    }, 400);
  }, [newUsername, username]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }

    setUploading(true);
    setError("");

    const ext      = file.name.split(".").pop();
    const filePath = `${username}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload photo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`; // cache bust

    // Save to user_profiles
    await supabase.from("user_profiles").upsert({
      username, avatar_url: publicUrl, updated_at: new Date().toISOString(),
    }, { onConflict: "username" });

    setAvatarUrl(publicUrl);
    setUploading(false);
    setSuccess("Photo updated!");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleSaveUsername() {
    if (newUsername === username) return;
    if (!newUsername.trim() || newUsername.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!nameAvailable) { setError("Username is already taken"); return; }

    setSaving(true);
    setError("");

    const trimmed = newUsername.trim().toLowerCase();

    // Update users table
    const { error: updateError } = await supabase.from("users")
      .update({ username: trimmed }).eq("username", username);

    if (updateError) {
      setError("Failed to update username");
      setSaving(false);
      return;
    }

    // Update user_profiles table
    await supabase.from("user_profiles")
      .update({ username: trimmed }).eq("username", username);

    // Update localStorage
    localStorage.setItem("runit_user", JSON.stringify({ username: trimmed }));

    setSaving(false);
    setSuccess("Username updated!");
    onUsernameChange(trimmed);
    setTimeout(() => setSuccess(""), 3000);
  }

  const usernameChanged = newUsername.trim() !== username;
  const canSave = usernameChanged && nameAvailable === true && !saving;

  return (
    <div>
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--green)", fontWeight: 600, fontSize: 13,
        padding: "0 0 16px 0", fontFamily: "inherit", display: "block",
      }}>← Settings</button>

      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Edit Profile</div>

      {/* Avatar section */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
        <div
          style={{ position: "relative", cursor: "pointer" }}
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              style={{
                width: 88, height: 88, borderRadius: "50%",
                objectFit: "cover", border: "3px solid var(--green)",
              }}
            />
          ) : (
            <div style={{
              width: 88, height: 88, borderRadius: "50%",
              background: "var(--green)", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 36, fontWeight: 700, color: "#fff",
              border: "3px solid var(--green)",
            }}>
              {username[0].toUpperCase()}
            </div>
          )}

          {/* Upload overlay */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {uploading ? (
              <div style={{ color: "#fff", fontSize: 11 }}>...</div>
            ) : (
              <div style={{ color: "#fff", fontSize: 20 }}>📷</div>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: "none" }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            marginTop: 10, fontSize: 13, color: "var(--green)",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 600,
          }}
        >
          {uploading ? "Uploading..." : "Change photo"}
        </button>
      </div>

      {/* Username section */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, color: "var(--text-3)",
          textTransform: "uppercase" as const, letterSpacing: 0.5,
          display: "block", marginBottom: 6,
        }}>Username</label>

        <div style={{ position: "relative" }}>
          <input
            value={newUsername}
            onChange={(e) => {
              setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              setError("");
            }}
            placeholder="username"
            style={{
              width: "100%", padding: "11px 40px 11px 14px",
              borderRadius: 12, fontSize: 14, fontFamily: "inherit",
              border: `1.5px solid ${
                !usernameChanged ? "var(--border-mid)" :
                nameAvailable === true ? "var(--green)" :
                nameAvailable === false ? "#E24B4A" : "var(--border-mid)"
              }`,
              background: "var(--surface)", color: "var(--text)",
              outline: "none", boxSizing: "border-box" as const,
            }}
          />
          <div style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 14,
          }}>
            {checkingName ? "⏳" :
             nameAvailable === true ? "✅" :
             nameAvailable === false ? "❌" : ""}
          </div>
        </div>

        {usernameChanged && !checkingName && (
          <div style={{
            fontSize: 11, marginTop: 4,
            color: nameAvailable === true ? "var(--green)" :
                   nameAvailable === false ? "#E24B4A" : "var(--text-3)",
          }}>
            {nameAvailable === true ? "Username is available" :
             nameAvailable === false ? "Username is already taken" :
             newUsername.length < 3 ? "Must be at least 3 characters" : ""}
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          Only letters, numbers and underscores
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          background: "#FCEBEB", color: "#A32D2D", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          background: "#E1F5EE", color: "#085041", fontSize: 13, fontWeight: 600,
        }}>
          ✓ {success}
        </div>
      )}

      <button
        onClick={handleSaveUsername}
        disabled={!canSave}
        style={{
          width: "100%", padding: "13px", borderRadius: 12,
          border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 14,
          background: canSave ? "var(--green)" : "var(--border-mid)",
          color: "#fff", cursor: canSave ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        {saving ? "Saving..." : "Save username"}
      </button>
    </div>
  );
}
