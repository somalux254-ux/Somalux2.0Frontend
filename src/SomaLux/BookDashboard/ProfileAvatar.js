import React, { useRef, useState } from "react";
import { FiCamera } from "react-icons/fi";
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
  const [isSavingImage, setIsSavingImage] = useState(false);

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
    console.log('handleUpload triggered');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name, file.type, file.size);

    // Basic validation
    if (!file.type.startsWith('image/')) {
      console.log('Invalid file type:', file.type);
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

    if (!authUser || !authUser.id) {
      toast.info('Sign in to save your profile photo permanently');
      return;
    }

    setIsSavingImage(true);

    try {
      const ext = file.name.split('.').pop();
      // Simplify file path - just use timestamp and extension
      const fileName = `${Date.now()}.${ext}`;
      console.log('Uploading file as:', fileName);

      // Upload to storage bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });
      console.log('Upload response received - uploadData:', uploadData, 'uploadError:', uploadError);

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        const errMsg = uploadError.message || JSON.stringify(uploadError);
        toast.error('Avatar upload failed: ' + errMsg, { autoClose: 6000 });
        setIsSavingImage(false);
        return;
      }

      console.info('Avatar uploaded successfully');
      const publicUrl = supabase.storage.from('user-avatars').getPublicUrl(fileName).data.publicUrl;

      // Avatar is already uploaded to storage successfully
      console.log('Avatar uploaded and available at:', publicUrl);

      // Update auth user metadata
      try {
        await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        console.log('Auth metadata updated');
      } catch (uErr) {
        console.warn('Failed to update auth user metadata:', uErr?.message);
      }

      // Update local storage
      const stored = getStoredUserProfile(authUser);
      const merged = { ...stored, avatar: publicUrl, avatar_path: fileName };
      const key = authUser?.id ? `userProfile_${authUser.id}` : 'userProfile';
      localStorage.setItem(key, JSON.stringify(merged));
      if (!authUser?.id) {
        localStorage.setItem('userProfile', JSON.stringify(merged));
      }
      console.log('Local storage updated');
      
      // Update avatar map
      try {
        const map = JSON.parse(localStorage.getItem('avatarsByEmail') || '{}');
        if (authUser?.email) {
          map[authUser.email] = publicUrl;
          localStorage.setItem('avatarsByEmail', JSON.stringify(map));
        }
      } catch (e) {
        console.warn('Avatar map update failed:', e?.message);
      }
      
      // Update profiles table with avatar URL and file path
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            avatar_url: publicUrl,
            avatar_path: fileName  // Also save the file name for reference
          })
          .eq('id', authUser?.id);
        if (profileError) {
          console.warn('Failed to update profile avatar_url:', profileError?.message);
        } else {
          console.log('Profile avatar_url and avatar_path updated successfully');
        }
      } catch (e) {
        console.warn('Error updating profile:', e?.message);
      }
      
      // Update UI
      setProfileImage(publicUrl);
      console.log('UI updated with new avatar');

      // Delete previous avatar if exists
      try {
        if (prevAvatarPath && prevAvatarPath !== fileName) {
          const { error: delErr } = await supabase.storage.from('user-avatars').remove([prevAvatarPath]);
          if (delErr) {
            console.warn('Failed to delete previous avatar:', delErr?.message);
          } else {
            console.info('Previous avatar deleted:', prevAvatarPath);
          }
        }
      } catch (delEx) {
        console.warn('Error deleting previous avatar:', delEx?.message);
      }
    } catch (err) {
      console.error('handleUpload error', err);
      toast.error('Unexpected error saving avatar');
    } finally {
      setIsSavingImage(false);
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
            console.warn('Profile image failed to load');
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