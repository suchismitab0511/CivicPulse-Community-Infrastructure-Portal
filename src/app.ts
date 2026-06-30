import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  increment, 
  setDoc, 
  getDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";

// REPLACE WITH YOUR FIREBASE CONFIG (Configured dynamically from system-provided details)
const firebaseConfig = {
  apiKey: "AIzaSyDWIl39z2tH-rN36b49aXcVh9kgpkuvIq4",
  authDomain: "silicon-earth-4fbwx.firebaseapp.com",
  projectId: "silicon-earth-4fbwx",
  storageBucket: "silicon-earth-4fbwx.firebasestorage.app",
  messagingSenderId: "899108516454",
  appId: "1:899108516454:web:54e061b56443f7b25a33a7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Connecting to the custom provisioned database ID
const db = getFirestore(app, "ai-studio-civicpulse-aeb15613-78d2-41ab-a073-01c7698db923");

// Declare global variables from CDN script tags for the TypeScript compiler
declare let L: any;
declare let Chart: any;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Define Interface Types
interface Issue {
  id: string;
  category: string;
  severity: string;
  description: string;
  suggested_action?: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  address: string;
  upvotes: number;
  upvotedBy: string[];
  status: "Open" | "In Progress" | "Resolved";
  createdAt: Timestamp;
}

interface Contributor {
  id: string;
  username: string;
  points: number;
}

// Global Application State Variables
let currentSessionId = "";
let currentUsername = "";
let currentUserPoints = 0;
let map: any = null;
let markersGroup: any = null;
let activeIssues: Issue[] = [];
let categoryChart: any = null;
let severityChart: any = null;
let currentCompressedImageBase64 = "";
let currentMimeType = "image/jpeg";
let feedSortBy: "newest" | "upvotes" = "newest";

// Default coordinate center (San Francisco)
const defaultCenter = { lat: 37.7749, lng: -122.4194 };

// DOM Element References
const dragDropArea = document.getElementById("drag-drop-area") as HTMLDivElement;
const imageUploadInput = document.getElementById("image-upload") as HTMLInputElement;
const uploadPlaceholder = document.getElementById("upload-placeholder") as HTMLDivElement;
const imagePreviewContainer = document.getElementById("image-preview-container") as HTMLDivElement;
const imagePreview = document.getElementById("image-preview") as HTMLImageElement;
const removeImageBtn = document.getElementById("remove-image-btn") as HTMLButtonElement;
const analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
const analyzeBtnText = document.getElementById("analyze-btn-text") as HTMLSpanElement;
const analyzeProgress = document.getElementById("analyze-progress") as HTMLDivElement;
const geolocateBtn = document.getElementById("geolocate-btn") as HTMLButtonElement;
const geolocateBtnText = document.getElementById("geolocate-btn-text") as HTMLSpanElement;
const latitudeField = document.getElementById("latitude-field") as HTMLInputElement;
const longitudeField = document.getElementById("longitude-field") as HTMLInputElement;
const addressField = document.getElementById("address-field") as HTMLInputElement;
const aiBadge = document.getElementById("ai-badge") as HTMLSpanElement;
const categorySelect = document.getElementById("category-select") as HTMLSelectElement;
const severitySelect = document.getElementById("severity-select") as HTMLSelectElement;
const descriptionArea = document.getElementById("description-area") as HTMLTextAreaElement;
const actionField = document.getElementById("action-field") as HTMLInputElement;
const issueForm = document.getElementById("issue-form") as HTMLFormElement;
const toggleDashboardBtn = document.getElementById("toggle-dashboard-btn") as HTMLButtonElement;
const closeDashboardBtn = document.getElementById("close-dashboard-btn") as HTMLButtonElement;
const impactDashboard = document.getElementById("impact-dashboard") as HTMLElement;
const mapFilterSeverity = document.getElementById("map-filter-severity") as HTMLSelectElement;
const mapFilterCategory = document.getElementById("map-filter-category") as HTMLSelectElement;
const feedTabNewest = document.getElementById("feed-tab-newest") as HTMLButtonElement;
const feedTabVoted = document.getElementById("feed-tab-voted") as HTMLButtonElement;
const feedContainer = document.getElementById("feed-container") as HTMLDivElement;
const feedEmptyState = document.getElementById("feed-empty-state") as HTMLDivElement;

// User Card elements
const userDisplayName = document.getElementById("user-display-name") as HTMLParagraphElement;
const userSessionIdLabel = document.getElementById("user-session-id") as HTMLParagraphElement;
const userPointsCounter = document.getElementById("user-points-counter") as HTMLSpanElement;
const userRankLabel = document.getElementById("user-rank-label") as HTMLSpanElement;
const userAvatarElement = document.getElementById("user-avatar") as HTMLDivElement;
const leaderboardContainer = document.getElementById("leaderboard-container") as HTMLDivElement;

// Quick Stats elements
const quickStatTotal = document.getElementById("quick-stat-total") as HTMLSpanElement;
const quickStatResolved = document.getElementById("quick-stat-resolved") as HTMLSpanElement;

// Initialize Leaflet Map
function initializeMap(lat: number, lng: number) {
  if (map) return;

  // Render OSM Map with polished tile set (CartoDB Positron for modern aesthetic)
  map = L.map("map").setView([lat, lng], 13);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);

  // Add initial user marker
  L.marker([lat, lng], {
    icon: L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-20"></span>
          <div class="relative rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow flex items-center justify-center">
            <div class="h-1 w-1 bg-white rounded-full"></div>
          </div>
        </div>`,
      className: "user-loc-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  }).addTo(map).bindPopup("<b>You are here</b><br>Detected neighborhood context").openPopup();
}

// Browser Geolocation
function detectUserLocation() {
  geolocateBtnText.innerText = "Locating...";
  geolocateBtn.disabled = true;

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    geolocateBtnText.innerText = "Auto-Detect";
    geolocateBtn.disabled = false;
    initializeMap(defaultCenter.lat, defaultCenter.lng);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      latitudeField.value = lat.toFixed(6);
      longitudeField.value = lng.toFixed(6);

      geolocateBtnText.innerText = "Detected!";
      geolocateBtn.classList.remove("text-blue-600");
      geolocateBtn.classList.add("text-emerald-600");

      initializeMap(lat, lng);
      if (map) {
        map.setView([lat, lng], 14);
      }

      // Reverse geocode to human-readable address via OSM Nominatim API
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          addressField.value = data.display_name;
        }
      } catch (err) {
        console.warn("Address reverse geocoding failed, manual input remains:", err);
      }
    },
    (error) => {
      console.warn("Geolocation permission denied/failed:", error);
      geolocateBtnText.innerText = "Auto-Detect";
      geolocateBtn.disabled = false;
      // Default fallback
      latitudeField.value = defaultCenter.lat.toFixed(6);
      longitudeField.value = defaultCenter.lng.toFixed(6);
      initializeMap(defaultCenter.lat, defaultCenter.lng);
    },
    { timeout: 8000 }
  );
}

// Gamification & Session Management
async function initUserSession() {
  let storedSessionId = localStorage.getItem("civicpulse_session");
  let storedUsername = localStorage.getItem("civicpulse_username");
  let storedPoints = localStorage.getItem("civicpulse_points");

  if (!storedSessionId) {
    storedSessionId = "user_" + Math.random().toString(36).substring(2, 11);
    storedUsername = "Citizen #" + Math.floor(1000 + Math.random() * 9000);
    storedPoints = "0";

    localStorage.setItem("civicpulse_session", storedSessionId);
    localStorage.setItem("civicpulse_username", storedUsername);
    localStorage.setItem("civicpulse_points", storedPoints);
  }

  currentSessionId = storedSessionId;
  currentUsername = storedUsername || "Citizen #Anonymous";
  currentUserPoints = parseInt(storedPoints || "0", 10);

  // Render User details in panel
  userDisplayName.innerText = currentUsername;
  userSessionIdLabel.innerText = `Session ID: ${currentSessionId}`;
  userPointsCounter.innerText = currentUserPoints.toString();
  
  // Custom initial avatar letter
  userAvatarElement.innerText = currentUsername.charAt(0) + currentUsername.charAt(currentUsername.length - 1);

  // Sync user stats with Firestore
  await syncUserWithFirestore();
}

async function syncUserWithFirestore() {
  const userRef = doc(db, "contributors", currentSessionId);
  let docSnap;
  try {
    docSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "contributors");
    return;
  }

  if (docSnap.exists()) {
    const dbData = docSnap.data();
    currentUserPoints = dbData.points || 0;
    localStorage.setItem("civicpulse_points", currentUserPoints.toString());
    userPointsCounter.innerText = currentUserPoints.toString();
  } else {
    try {
      await setDoc(userRef, {
        id: currentSessionId,
        username: currentUsername,
        points: currentUserPoints,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "contributors");
      return;
    }
  }

  updateUserRankLabel();
}

function updateUserRankLabel() {
  let rank = "Novice Ranger";
  let badgeColor = "bg-slate-700";

  if (currentUserPoints >= 50) {
    rank = "Community Hero";
    badgeColor = "bg-amber-500";
  } else if (currentUserPoints >= 20) {
    rank = "Civic Protector";
    badgeColor = "bg-blue-600";
  }

  userRankLabel.innerText = rank;
  userRankLabel.className = `text-xs font-bold px-2 py-0.5 rounded-full text-white ${badgeColor} block mt-1`;
}

async function addPoints(amount: number) {
  currentUserPoints += amount;
  localStorage.setItem("civicpulse_points", currentUserPoints.toString());
  userPointsCounter.innerText = currentUserPoints.toString();
  updateUserRankLabel();

  // Save to Firestore
  try {
    const userRef = doc(db, "contributors", currentSessionId);
    await updateDoc(userRef, {
      points: increment(amount),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "contributors");
  }
}

// Canvas Image Compression helper to prevent exceeding Firestore sizes
function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export as compressed JPEG
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          resolve({
            base64: dataUrl,
            mimeType: "image/jpeg"
          });
        } else {
          reject(new Error("Failed to get canvas 2D context"));
        }
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// Drag and drop photo setup
function setupImageUpload() {
  dragDropArea.addEventListener("click", () => {
    imageUploadInput.click();
  });

  dragDropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dragDropArea.classList.add("border-blue-500", "bg-blue-50/20");
  });

  dragDropArea.addEventListener("dragleave", () => {
    dragDropArea.classList.remove("border-blue-500", "bg-blue-50/20");
  });

  dragDropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDropArea.classList.remove("border-blue-500", "bg-blue-50/20");
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  imageUploadInput.addEventListener("change", () => {
    const files = imageUploadInput.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  removeImageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetImageState();
  });
}

async function handleFileSelected(file: File) {
  if (!file.type.match("image/png") && !file.type.match("image/jpeg") && !file.type.match("image/jpg")) {
    alert("Please upload a valid JPG or PNG image");
    return;
  }

  try {
    uploadPlaceholder.classList.add("hidden");
    imagePreviewContainer.classList.remove("hidden");
    imagePreview.src = URL.createObjectURL(file);

    // Show analyzer button as active
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove("bg-slate-100", "text-slate-400");
    analyzeBtn.classList.add("bg-gradient-to-r", "from-blue-600", "to-indigo-600", "text-white", "hover:opacity-90");

    // Compress in background
    const result = await compressImage(file);
    currentCompressedImageBase64 = result.base64;
    currentMimeType = result.mimeType;
  } catch (error) {
    console.error("Image compression error:", error);
    alert("Failed to process image. Please try another photo.");
    resetImageState();
  }
}

function resetImageState() {
  imageUploadInput.value = "";
  currentCompressedImageBase64 = "";
  imagePreview.src = "";
  imagePreviewContainer.classList.add("hidden");
  uploadPlaceholder.classList.remove("hidden");
  
  analyzeBtn.disabled = true;
  analyzeBtn.className = "w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 font-bold rounded-xl border border-slate-200 hover:border-slate-300 disabled:border-slate-100 shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed";
  
  aiBadge.classList.add("hidden");
}

// Call Gemini Proxy via server route
async function analyzeImageWithAI() {
  if (!currentCompressedImageBase64) return;

  // Extract raw base64 data (strip prefix)
  const rawBase64 = currentCompressedImageBase64.split(",")[1];

  analyzeBtn.classList.add("hidden");
  analyzeProgress.classList.remove("hidden");

  try {
    const response = await fetch("/api/analyze-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        imageBase64: rawBase64,
        mimeType: currentMimeType
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || "Analysis failed");
    }

    const result = await response.json();
    console.log("Gemini response parsed successfully:", result);

    // Populate fields
    if (result.category) {
      // Map other variants if they don't exactly match select values
      let mappedCat = result.category.toLowerCase();
      if (mappedCat === "streetlight_damage" || mappedCat === "streetlight") {
        mappedCat = "streetlight_damage";
      } else if (mappedCat === "water_leak" || mappedCat === "pipe_burst") {
        mappedCat = "water_leak";
      } else if (mappedCat === "garbage_overflow" || mappedCat === "garbage" || mappedCat === "trash") {
        mappedCat = "garbage_overflow";
      } else if (mappedCat === "road_damage" || mappedCat === "pavement_damage") {
        mappedCat = "road_damage";
      } else if (mappedCat === "pothole") {
        mappedCat = "pothole";
      } else {
        mappedCat = "other";
      }
      categorySelect.value = mappedCat;
    }

    if (result.severity) {
      const mappedSev = result.severity.charAt(0).toUpperCase() + result.severity.slice(1).toLowerCase();
      if (["Low", "Medium", "High", "Critical"].includes(mappedSev)) {
        severitySelect.value = mappedSev;
      }
    }

    if (result.description) {
      descriptionArea.value = result.description;
    }

    if (result.suggested_action) {
      actionField.value = result.suggested_action;
    }

    // Animate the verification badge
    aiBadge.classList.remove("hidden");
    
  } catch (error: any) {
    console.error("Gemini Image Analysis failed:", error);
    alert("AI Analysis encountered an error: " + error.message + ". You can still manually fill in the fields below!");
  } finally {
    analyzeProgress.classList.add("hidden");
    analyzeBtn.classList.remove("hidden");
  }
}

// Submit Issue Form to Firebase Firestore
async function handleFormSubmit(e: Event) {
  e.preventDefault();

  if (!currentCompressedImageBase64) {
    alert("Please select and upload an issue photo first");
    return;
  }

  const lat = parseFloat(latitudeField.value);
  const lng = parseFloat(longitudeField.value);
  const address = addressField.value.trim();
  const category = categorySelect.value;
  const severity = severitySelect.value;
  const description = descriptionArea.value.trim();
  const action = actionField.value.trim() || "Local dispatch crew inspection";

  if (isNaN(lat) || isNaN(lng) || !address) {
    alert("A manual address or auto-detected geolocation coordinate is required");
    return;
  }

  // Set submitting states
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerText = "Submitting issue...";

  try {
    const issuesCol = collection(db, "issues");
    await addDoc(issuesCol, {
      category,
      severity,
      description,
      suggested_action: action,
      imageUrl: currentCompressedImageBase64,
      latitude: lat,
      longitude: lng,
      address,
      upvotes: 0,
      upvotedBy: [],
      status: "Open",
      createdAt: serverTimestamp()
    });

    // Reward points for reporting
    await addPoints(10);
    alert("Thank you! Your issue was successfully reported and mapped live. You earned +10 points!");

    // Reset Form
    issueForm.reset();
    resetImageState();
    
    // Clear geolocation detection results classes
    geolocateBtnText.innerText = "Auto-Detect";
    geolocateBtn.disabled = false;
    geolocateBtn.className = "text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer";
    latitudeField.value = "";
    longitudeField.value = "";

  } catch (err: any) {
    handleFirestoreError(err, OperationType.CREATE, "issues");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// Live real-time Firestore synchronization
function startRealtimeSync() {
  const issuesCol = collection(db, "issues");
  const q = query(issuesCol, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const issues: Issue[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      issues.push({
        id: docSnap.id,
        category: data.category || "other",
        severity: data.severity || "Medium",
        description: data.description || "",
        suggested_action: data.suggested_action || "",
        imageUrl: data.imageUrl || "",
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        address: data.address || "Unspecified Location",
        upvotes: Number(data.upvotes || 0),
        upvotedBy: data.upvotedBy || [],
        status: data.status || "Open",
        createdAt: data.createdAt
      });
    });

    activeIssues = issues;
    console.log("Realtime Firestore issues synchronized:", activeIssues.length);

    // Refresh UI Components
    renderMapMarkers();
    renderCommunityFeed();
    updateDashboard();
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, "issues");
  });

  // Also sync Leaderboard (Top contributors)
  const contributorsCol = collection(db, "contributors");
  const leadersQuery = query(contributorsCol, orderBy("points", "desc"));

  onSnapshot(leadersQuery, (snapshot) => {
    const users: Contributor[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      users.push({
        id: docSnap.id,
        username: data.username || "Citizen",
        points: data.points || 0
      });
    });

    renderLeaderboard(users.slice(0, 3));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, "contributors");
  });
}

// Render Leaderboard podium
function renderLeaderboard(leaders: Contributor[]) {
  leaderboardContainer.innerHTML = "";
  if (leaders.length === 0) {
    leaderboardContainer.innerHTML = `
      <div class="text-xs text-slate-500 italic text-center py-2">
        No active contributors yet
      </div>`;
    return;
  }

  leaders.forEach((user, index) => {
    const medals = ["🥇", "🥈", "🥉"];
    const colors = ["text-amber-400 font-extrabold", "text-slate-300 font-extrabold", "text-amber-600 font-extrabold"];
    const isMe = user.id === currentSessionId;

    const rankDiv = document.createElement("div");
    rankDiv.className = `flex items-center justify-between bg-slate-800/40 p-3 rounded-xl border ${isMe ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-800'} text-sm hover:scale-101 transition-all`;
    rankDiv.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="${colors[index] || 'text-slate-400'} text-base">${medals[index] || (index + 1) + '.'}</span>
        <span class="font-bold truncate max-w-[120px] ${isMe ? 'text-blue-400' : 'text-slate-200'}">${user.username} ${isMe ? '(You)' : ''}</span>
      </div>
      <div class="text-right">
        <span class="text-xs text-slate-400">Points</span>
        <span class="font-extrabold text-slate-100 block">${user.points}</span>
      </div>`;
    leaderboardContainer.appendChild(rankDiv);
  });
}

// Filter logic helper
function getFilteredIssues(): Issue[] {
  const categoryFilter = mapFilterCategory.value;
  const severityFilter = mapFilterSeverity.value;

  return activeIssues.filter(issue => {
    const matchCat = categoryFilter === "ALL" || issue.category === categoryFilter;
    const matchSev = severityFilter === "ALL" || issue.severity === severityFilter;
    return matchCat && matchSev;
  });
}

// Render map markers based on filters
function renderMapMarkers() {
  if (!map || !markersGroup) return;

  // Clear existing layers
  markersGroup.clearLayers();

  const filtered = getFilteredIssues();

  filtered.forEach((issue) => {
    if (isNaN(issue.latitude) || isNaN(issue.longitude)) return;

    // Define color codes (red=Critical, orange=High, yellow=Medium, green=Low)
    const markerColor = issue.severity === "Critical" ? "#EA4335" :
                        issue.severity === "High" ? "#F97316" :
                        issue.severity === "Medium" ? "#FBBC04" : "#34A853";

    const customIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-[${markerColor}] opacity-45"></span>
          <div class="relative rounded-full h-4.5 w-4.5 bg-[${markerColor}] border-2 border-white shadow-lg flex items-center justify-center">
            <span class="text-xxs text-white font-black">${issue.severity.charAt(0)}</span>
          </div>
        </div>`,
      className: "custom-div-icon",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const popupHtml = `
      <div class="w-64 space-y-3 font-sans rounded-xl overflow-hidden p-1">
        ${issue.imageUrl ? `<img src="${issue.imageUrl}" class="w-full h-28 object-cover rounded-lg shadow-inner" />` : ''}
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xxs uppercase font-extrabold tracking-wider bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full">${issue.category.replace('_', ' ')}</span>
            <span class="text-xxs uppercase font-bold text-white px-2 py-0.5 rounded-full" style="background-color: ${markerColor}">${issue.severity}</span>
          </div>
          <p class="text-xs text-slate-700 font-medium leading-relaxed">${issue.description}</p>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-2 text-xxs text-slate-500">
          <span>📍 ${issue.address.split(',')[0]}</span>
          <span class="font-bold text-slate-800">▲ ${issue.upvotes} Upvotes</span>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-2">
          <span class="px-2 py-1 rounded bg-slate-100 text-slate-800 text-xxs font-bold">Status: ${issue.status}</span>
          <button onclick="window.upvoteFromMap('${issue.id}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xxs rounded transition shadow cursor-pointer">Upvote</button>
        </div>
      </div>`;

    L.marker([issue.latitude, issue.longitude], { icon: customIcon })
      .addTo(markersGroup)
      .bindPopup(popupHtml);
  });
}

// Bind Map Upvote globally for HTML popup strings
(window as any).upvoteFromMap = async (issueId: string) => {
  await handleUpvote(issueId);
};

// Render Community Feed
function renderCommunityFeed() {
  feedContainer.innerHTML = "";

  let list = [...activeIssues];

  // Sorting logic
  if (feedSortBy === "newest") {
    // Already newest sorted by Firestore default query
  } else if (feedSortBy === "upvotes") {
    list.sort((a, b) => b.upvotes - a.upvotes);
  }

  if (list.length === 0) {
    feedEmptyState.classList.remove("hidden");
    return;
  } else {
    feedEmptyState.classList.add("hidden");
  }

  list.forEach((issue) => {
    // Calculate matching color pills
    const colorClass = issue.severity === "Critical" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                        issue.severity === "High" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                        issue.severity === "Medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : 
                        "bg-green-500/10 text-green-600 border-green-500/20";

    const hasUpvoted = issue.upvotedBy?.includes(currentSessionId);

    const card = document.createElement("div");
    card.className = "py-5 flex flex-col md:flex-row gap-4 group hover:bg-slate-50/60 p-4 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-100";
    card.innerHTML = `
      <!-- Thumbnail image section -->
      <div class="w-full md:w-36 h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative shadow-inner">
        ${issue.imageUrl ? `<img src="${issue.imageUrl}" class="w-full h-full object-cover group-hover:scale-102 transition duration-300" />` : `
          <div class="w-full h-full flex items-center justify-center text-slate-400">
            No Photo
          </div>`}
      </div>

      <!-- Feed Details section -->
      <div class="flex-1 space-y-2 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <!-- Category Badge -->
          <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 uppercase tracking-wide">
            ${issue.category.replace('_', ' ')}
          </span>
          <!-- Severity Badge -->
          <span class="text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${colorClass}">
            ${issue.severity} Severity
          </span>
          <!-- Status Pill -->
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${issue.status === 'Resolved' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : issue.status === 'In Progress' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-slate-900 text-white'}">
            ${issue.status}
          </span>
        </div>

        <p class="text-sm font-semibold text-slate-900 leading-snug break-words">${issue.description}</p>
        
        <!-- Address location info -->
        <p class="text-xs text-slate-500 flex items-center">
          <svg class="h-3 w-3 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span class="truncate">${issue.address}</span>
        </p>

        <!-- Suggested Action section -->
        ${issue.suggested_action ? `
          <div class="bg-blue-50/50 border border-blue-100/40 p-2 rounded-lg mt-1">
            <p class="text-xxs font-black text-blue-700 uppercase tracking-wider flex items-center space-x-1">
              <span>⚡ AI Auto-Dispatch Action</span>
            </p>
            <p class="text-xs text-blue-800/90 leading-tight mt-0.5 font-medium">${issue.suggested_action}</p>
          </div>` : ''}
      </div>

      <!-- Action panel (upvotes & change status for simulation) -->
      <div class="flex md:flex-col justify-between md:justify-center items-center gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 pl-1">
        <button id="upvote-btn-${issue.id}" class="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border ${hasUpvoted ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} transition shadow-sm cursor-pointer text-xs font-bold w-full justify-center">
          <span>▲</span>
          <span>${issue.upvotes} Upvotes</span>
        </button>

        <!-- Dynamic Status Toggler (Lets user demonstrate community resolution) -->
        <div class="w-full flex flex-col">
          <span class="text-xxs font-bold text-slate-400 mb-0.5 text-center">Status Action</span>
          <select id="status-select-${issue.id}" class="text-xs border border-slate-200 rounded-lg p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-100 cursor-pointer">
            <option value="Open" ${issue.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${issue.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${issue.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      </div>`;

    feedContainer.appendChild(card);

    // Attach dynamic click events
    const upvoteBtn = card.querySelector(`#upvote-btn-${issue.id}`) as HTMLButtonElement;
    upvoteBtn.addEventListener("click", () => handleUpvote(issue.id));

    const statusSelect = card.querySelector(`#status-select-${issue.id}`) as HTMLSelectElement;
    statusSelect.addEventListener("change", () => handleStatusChange(issue.id, statusSelect.value as any));
  });
}

// Handle upvote action
async function handleUpvote(issueId: string) {
  const issue = activeIssues.find(i => i.id === issueId);
  if (!issue) return;

  if (issue.upvotedBy?.includes(currentSessionId)) {
    alert("You have already upvoted this issue report!");
    return;
  }

  try {
    const docRef = doc(db, "issues", issueId);
    await updateDoc(docRef, {
      upvotes: increment(1),
      upvotedBy: arrayUnion(currentSessionId)
    });

    // Reward points for upvoting
    await addPoints(2);
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, "issues");
  }
}

// Handle status change
async function handleStatusChange(issueId: string, newStatus: "Open" | "In Progress" | "Resolved") {
  try {
    const docRef = doc(db, "issues", issueId);
    await updateDoc(docRef, {
      status: newStatus
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, "issues");
  }
}

// Update Impact Dashboard numbers and Charts
function updateDashboard() {
  const total = activeIssues.length;
  const resolved = activeIssues.filter(i => i.status === "Resolved").length;
  const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Sync quick labels
  quickStatTotal.innerText = total.toString();
  quickStatResolved.innerText = `${resolvedRate}%`;

  // Sync full panel
  const dbTotalReports = document.getElementById("db-total-reports") as HTMLSpanElement;
  const dbResolvedWeek = document.getElementById("db-resolved-week") as HTMLSpanElement;
  const dbActiveArea = document.getElementById("db-active-area") as HTMLSpanElement;

  if (dbTotalReports) dbTotalReports.innerText = total.toString();
  if (dbResolvedWeek) dbResolvedWeek.innerText = resolved.toString();

  // Find most common location string
  if (dbActiveArea) {
    if (activeIssues.length === 0) {
      dbActiveArea.innerText = "No issues yet";
    } else {
      const addresses = activeIssues.map(i => i.address.split(',')[0]);
      const counts: Record<string, number> = {};
      let maxAddr = "";
      let maxCount = 0;

      addresses.forEach(addr => {
        counts[addr] = (counts[addr] || 0) + 1;
        if (counts[addr] > maxCount) {
          maxCount = counts[addr];
          maxAddr = addr;
        }
      });

      dbActiveArea.innerText = maxAddr || "Undetected";
    }
  }

  // Update Chart.js Charts
  renderCharts();
}

// Render dynamic metrics using Chart.js
function renderCharts() {
  // 1. Category Chart
  const categories = ["pothole", "streetlight_damage", "water_leak", "garbage_overflow", "road_damage", "other"];
  const categoryLabels = ["Pothole", "Streetlight", "Water Leak", "Garbage", "Road Damage", "Other"];
  const categoryCounts = categories.map(cat => activeIssues.filter(i => i.category === cat).length);

  const catCanvas = document.getElementById("category-chart") as HTMLCanvasElement;
  if (catCanvas) {
    if (categoryChart) {
      categoryChart.destroy();
    }
    categoryChart = new Chart(catCanvas, {
      type: "bar",
      data: {
        labels: categoryLabels,
        datasets: [{
          label: "Report Counts",
          data: categoryCounts,
          backgroundColor: [
            "rgba(26, 115, 232, 0.75)",  // Google Blue
            "rgba(245, 158, 11, 0.75)",  // Warning Orange
            "rgba(52, 168, 83, 0.75)",   // Accent Green
            "rgba(234, 67, 53, 0.75)",   // Danger Red
            "rgba(139, 92, 246, 0.75)",  // Purple
            "rgba(100, 116, 139, 0.75)"  // Gray
          ],
          borderColor: [
            "#1A73E8",
            "#F59E0B",
            "#34A853",
            "#EA4335",
            "#8B5CF6",
            "#64748B"
          ],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  // 2. Severity Pie Chart
  const severities = ["Low", "Medium", "High", "Critical"];
  const severityCounts = severities.map(sev => activeIssues.filter(i => i.severity === sev).length);

  const sevCanvas = document.getElementById("severity-chart") as HTMLCanvasElement;
  if (sevCanvas) {
    if (severityChart) {
      severityChart.destroy();
    }
    severityChart = new Chart(sevCanvas, {
      type: "pie",
      data: {
        labels: severities,
        datasets: [{
          data: severityCounts,
          backgroundColor: [
            "rgba(52, 168, 83, 0.75)",   // Low - Green
            "rgba(251, 188, 4, 0.75)",   // Medium - Yellow
            "rgba(249, 115, 22, 0.75)",  // High - Orange
            "rgba(234, 67, 53, 0.75)"    // Critical - Red
          ],
          borderColor: [
            "#34A853",
            "#FBBC04",
            "#F97316",
            "#EA4335"
          ],
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { boxWidth: 12, font: { size: 11 } }
          }
        }
      }
    });
  }
}

// Attach general navigation listeners
function setupNavigationListeners() {
  toggleDashboardBtn.addEventListener("click", () => {
    impactDashboard.classList.toggle("hidden");
    // Trigger chart redraw when shown
    if (!impactDashboard.classList.contains("hidden")) {
      setTimeout(renderCharts, 100);
    }
  });

  closeDashboardBtn.addEventListener("click", () => {
    impactDashboard.classList.add("hidden");
  });

  // Filter selection change handlers
  mapFilterCategory.addEventListener("change", () => renderMapMarkers());
  mapFilterSeverity.addEventListener("change", () => renderMapMarkers());

  // Feed Tab Switch logic
  feedTabNewest.addEventListener("click", () => {
    feedSortBy = "newest";
    feedTabNewest.className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-900 shadow-sm transition cursor-pointer";
    feedTabVoted.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900 transition cursor-pointer";
    renderCommunityFeed();
  });

  feedTabVoted.addEventListener("click", () => {
    feedSortBy = "upvotes";
    feedTabVoted.className = "px-3 py-1 text-xs font-bold rounded-md bg-white text-slate-900 shadow-sm transition cursor-pointer";
    feedTabNewest.className = "px-3 py-1 text-xs font-bold rounded-md text-slate-600 hover:text-slate-900 transition cursor-pointer";
    renderCommunityFeed();
  });
}

// Initial Bootstrapping
async function bootstrap() {
  await initUserSession();
  setupImageUpload();
  setupNavigationListeners();

  geolocateBtn.addEventListener("click", detectUserLocation);
  analyzeBtn.addEventListener("click", analyzeImageWithAI);
  issueForm.addEventListener("submit", handleFormSubmit);

  // Initialize map centered at SF by default on boot
  initializeMap(defaultCenter.lat, defaultCenter.lng);
  
  // Start syncing real-time databases
  startRealtimeSync();

  // Try to query geolocation automatically
  detectUserLocation();
}

// Launch the application
window.addEventListener("DOMContentLoaded", bootstrap);
