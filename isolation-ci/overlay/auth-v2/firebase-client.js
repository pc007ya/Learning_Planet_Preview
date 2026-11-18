// PREVIEW ONLY: no Firebase SDK, credentials, persistence or backend connection.
export const auth = Object.freeze({ currentUser: null });
export const db = null, functions = null, googleProvider = null;
const blocked = () => { throw new Error('預覽站只開放 DEMO，正式帳號與雲端功能已停用。'); };
export const passwordLogin = blocked, recoverPasswordWithGoogle = blocked,
  linkCurrentUserWithGoogle = blocked, changeMyPassword = blocked,
  saveMyStudentProgress = blocked, saveWeeklyResult = blocked,
  changeMyStudentUsername = blocked, bootstrapFirstAdmin = blocked,
  resolveGoogleLinkConflict = blocked, loadRoleApi = blocked,
  doc = blocked, getDoc = blocked, setDoc = blocked, collection = blocked,
  getDocs = blocked, query = blocked, where = blocked, onSnapshot = blocked,
  loginEmailFor = blocked;
export const currentRole = async () => null, loadMyProfile = async () => null;
export const touchProfileLogin = async () => {}, clearRoleApi = () => {};
// No SDK signOut: this cannot change another application's saved session.
export const signOut = async () => {};
export function onAuthStateChanged(_auth, next) {
  let active = true;
  queueMicrotask(() => { if (active) next(null); });
  return () => { active = false; };
}
window.LearningPlanetAuthV2 = Object.freeze({ auth, db, functions, passwordLogin,
  recoverPasswordWithGoogle, currentRole, linkCurrentUserWithGoogle, touchProfileLogin,
  loadMyProfile, changeMyPassword, saveMyStudentProgress, saveWeeklyResult,
  changeMyStudentUsername, bootstrapFirstAdmin, resolveGoogleLinkConflict,
  onAuthStateChanged, signOut, loadRoleApi, clearRoleApi, previewOnly: true });
