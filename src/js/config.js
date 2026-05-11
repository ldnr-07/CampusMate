// ===== EMAILJS CONFIG =====
// Sign up at https://www.emailjs.com/ and configure these values:
const EMAILJS_CONFIG = {
  PUBLIC_KEY: 'YOUR_PUBLIC_KEY',      // Replace with your EmailJS public key
  SERVICE_ID: 'YOUR_SERVICE_ID',      // Replace with your EmailJS service ID (e.g., 'gmail')
  TEMPLATE_ID: 'YOUR_TEMPLATE_ID'     // Replace with your EmailJS template ID
};

// ===== GOOGLE SIGN-IN CONFIG =====
// Get your Client ID from https://console.cloud.google.com/apis/credentials
// Create OAuth 2.0 credentials and add your domain to Authorized JavaScript origins
const GOOGLE_CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',  // Replace with your Google OAuth 2.0 Client ID
};

// Store current Google user info
let googleUser = null;

// Temporary OTP storage (in-memory only)
let currentOTP = null;
let otpTargetEmail = null;

// ===== STATE =====
const state = {
  currentPage: 'page-login',
  calView: 'month',
  calDate: new Date(2026, 3, 1), // April 2026
  taskTab: 'current',
  examTab: 'incoming',
  activitiesOpen: true,
  classes: [],
  tasks: [],
  exams: [],
  events: [],
  selectedTaskId: null,
  selectedExamId: null,
  profile: {
    name: '',
    username: '',
    email: '',
    dob: '',
    sex: '',
    avatarUrl: '',
    createdAt: '',
    updatedAt: '',
  },
};
