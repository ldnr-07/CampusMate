// ===== GOOGLE SIGN-IN CONFIG =====
// Get your Client ID from https://console.cloud.google.com/apis/credentials
const GOOGLE_CONFIG = {
  CLIENT_ID: '283956397633-dgaa5e8qniiujssqv40uonrsf4d8fec3.apps.googleusercontent.com',
};

let googleUser = null;

// OTP storage — includes 10-min expiry and brute-force lockout
let currentOTP = null;
let otpTargetEmail = null;
let otpExpiry = null;
let otpAttempts = 0;
const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ===== STATE =====
const state = {
  currentPage: 'page-login',
  calView: 'day',
  calDate: new Date(),          // Always opens on the current month
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
    school: '',
    course: '',
    yearLevel: '',
    semester: '',
    academicYear: '',
  },
};