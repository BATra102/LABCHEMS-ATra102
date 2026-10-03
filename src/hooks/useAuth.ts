import { useLabContext } from '../context/LabContext';

export const useAuth = () => {
  const {
    currentUser,
    users,
    setCurrentUser,
    signInWithGoogle,
    signOut,
    isSupabaseConfigured,
    changeUserRole,
    updateUserLimits,
    deactivateUser,
    activateUser,
    deleteUser,
    restoreUser,
    addUser,
    isManager,
  } = useLabContext();

  return {
    user: currentUser,
    activeUser: currentUser,
    users,
    isAuthenticated: Boolean(currentUser),
    isManager,
    isSupabaseConfigured,
    switchUser: setCurrentUser,
    loginWithGoogle: signInWithGoogle,
    logout: signOut,
    changeUserRole,
    updateUserLimits,
    deactivateUser,
    activateUser,
    deleteUser,
    restoreUser,
    addUser,
  };
};
