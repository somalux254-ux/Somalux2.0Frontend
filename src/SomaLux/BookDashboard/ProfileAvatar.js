import React, { useRef } from "react";
import { toast } from "react-toastify";
import { supabase } from "../Books/supabaseClient";
import profilePlaceholder from "./user-profile.svg";

export const ProfilePlaceholder = ({ size = 72, onClick }) => (
  <div
    className="profile-placeholder"
    style={{ width: size, height: size, cursor: onClick ? 'pointer' : 'default' }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    aria-label={onClick ? 'Add profile photo' : 'Profile placeholder'}
  >
    <img className="profile-placeholder-image" src={profilePlaceholder} alt="Profile placeholder" />
  </div>
);

export const ProfileAvatar = ({ 
  profileImage, 
  setProfileImage, 
  authUser, 
  size = 72,
  showUploadButton = true 
}) => {
  const fileInputRef = useRef(null);

  const getStoredUserProfile = (user) => {
    const key = user?.id ? `userProfile_${user.id}` : 'userProfile';
    try {
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      if (current && Object.keys(current).length > 0) return current;
    } catch (e) {}

    try {
      return JSON.parse(localStorage.getItem('userProfile') || '{}');
    } catch (e) {
      return {};
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    // Basic validation
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result);
    reader.readAsDataURL(file);

    // Determine previous avatar object path for cleanup
    const prevStored = getStoredUserProfile(authUser);
    const prevAvatarUrl = prevStored?.avatar || authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || null;
    const extractPathFromUrl = (url) => {
      if (!url) return null;
      try {
        const marker = '/avatars/';
        const idx = url.indexOf(marker);
        if (idx === -1) return null;
        return url.substring(idx + marker.length);
      } catch (e) { return null; }
    };
    const prevAvatarPath = extractPathFromUrl(prevAvatarUrl);

    const { data: { session } = {} } = await supabase.auth.getSession();
    const sessionUser = session?.user;

    if (!sessionUser?.id) {
      toast.info('Sign in to save your profile photo permanently');
      return;
    }

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${sessionUser.id}/${Date.now()}.${ext}`;

      // Upload to storage bucket
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        const errMsg = uploadError.message || JSON.stringify(uploadError);
        toast.error('Avatar upload failed: ' + errMsg, { autoClose: 6000 });
        return;
      }

      const publicUrl = supabase.storage.from('user-avatars').getPublicUrl(fileName).data.publicUrl;

      // Avatar is already uploaded to storage successfully

      // Update auth user metadata
      try {
        await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      } catch {
      }

      // Update local storage
      const stored = getStoredUserProfile(sessionUser);
      const merged = { ...stored, avatar: publicUrl, avatar_path: fileName };
      const key = authUser?.id ? `userProfile_${authUser.id}` : 'userProfile';
      localStorage.setItem(key, JSON.stringify(merged));
      if (!authUser?.id) {
        localStorage.setItem('userProfile', JSON.stringify(merged));
      }
      
      // Update avatar map
      try {
        const map = JSON.parse(localStorage.getItem('avatarsByEmail') || '{}');
        if (sessionUser.email) {
          map[sessionUser.email] = publicUrl;
          localStorage.setItem('avatarsByEmail', JSON.stringify(map));
        }
      } catch (e) {
      }
      
      // Update profiles table with avatar URL and file path
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            avatar_url: publicUrl,
            avatar_path: fileName  // Also save the file name for reference
          })
          .eq('id', sessionUser.id);
        if (profileError) {
        } 
      } catch (e) {
      }
      
      // Update UI
      setProfileImage(publicUrl);

      // Delete previous avatar if exists
      try {
        if (prevAvatarPath && prevAvatarPath !== fileName) {
          const { error: delErr } = await supabase.storage.from('user-avatars').remove([prevAvatarPath]);
          if (delErr) {
          } 
        }
      } catch (delEx) {
      }
    } catch (err) {
      toast.error('Unexpected error saving avatar');
    }
  };

  return (
    <div className="profile-pic-wrapper">
      {profileImage ? (
        <img
          src={profileImage}
          className={size > 40 ? "profile-large" : "profile-avatar"}
          alt="Profile"
          onClick={showUploadButton ? () => fileInputRef.current?.click() : undefined}
          style={showUploadButton ? { cursor: 'pointer' } : {}}
          onError={() => {
            setProfileImage(null);
          }}
        />
      ) : (
        <ProfilePlaceholder
          size={size}
          onClick={showUploadButton ? () => fileInputRef.current?.click() : undefined}
        />
      )}
      
      {showUploadButton && (
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="image/*" 
          onChange={handleUpload} 
          style={{ display: "none" }} 
        />
      )}
    </div>
  );
};