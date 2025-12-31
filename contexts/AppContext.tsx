import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Appointment, Settings, Theme, ThemePalette, Message, Pendency, SettingCategory, TextPalette, FinancialTransaction, FinancialPage, FinancialAccount, ThirdParty, FinancialCategory, Service } from '../types.ts';
import { db, auth, messaging } from '../firebaseConfig.ts';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, DocumentData, writeBatch, setDoc, arrayUnion, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword as fbUpdatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { Page } from '../App.tsx';

// --- App Context ---
interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  themePalette: ThemePalette;
  setThemePalette: (palette: ThemePalette) => void;
  textPalette: TextPalette;
  setTextPalette: (palette: TextPalette) => void;
  user: User | null; // O usuário logado
  users: User[]; // Usuários vindos do DB
  appointments: Appointment[];
  pendencies: Pendency[];
  financials: FinancialTransaction[];
  accounts: FinancialAccount[];
  thirdParties: ThirdParty[];
  settings: Settings;
  logo: string | null;
  updateLogo: (logo: string | null) => Promise<void>;
  loading: boolean;
  notification: string | null;
  clearNotification: () => void;
  triggerNotification: (message?: string) => void;
  pageNotifications: Record<Page, boolean>;
  clearPageNotification: (page: Page) => void;
  
  // Auth
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;


  // Navigation
  activePage: Page;
  setActivePage: (page: Page) => void;
  activeFinancialPage: FinancialPage;
  setActiveFinancialPage: (page: FinancialPage) => void;
  
  // Appointment functions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'stringId'>) => Promise<void>;
  updateAppointment: (appointment: Appointment) => Promise<void>;
  deleteAppointment: (stringId: string) => Promise<void>;
  batchAddAppointments: (appointments: Omit<Appointment, 'id' | 'stringId'>[]) => Promise<void>;
  batchDeleteAppointments: (stringIds: string[]) => Promise<void>;
  addMessageToAppointment: (appointmentStringId: string, messageText: string) => Promise<void>;

  // Pendency functions
  addPendency: (pendency: Omit<Pendency, 'id' | 'stringId'>) => Promise<void>;
  updatePendency: (pendency: Pendency) => Promise<void>;
  deletePendency: (id: number) => Promise<void>;

  // Financial functions
  addFinancial: (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => Promise<void>;
  updateFinancial: (transaction: FinancialTransaction) => Promise<void>;
  deleteFinancial: (id: number) => Promise<void>;

  // Account functions
  addAccount: (account: Omit<FinancialAccount, 'id' | 'stringId'>) => Promise<void>;
  updateAccount: (account: FinancialAccount) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;

  // ThirdParty functions
  addThirdParty: (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => Promise<void>;
  updateThirdParty: (thirdParty: ThirdParty) => Promise<void>;
  deleteThirdParty: (id: number) => Promise<void>;

  // User functions
  addUser: (user: Omit<User, 'id'>) => Promise<{success: boolean, message: string}>;
  updateUser: (user: User) => Promise<void>;
  updateUserPhoto: (userId: string, photoURL: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
  resetPassword: (email: string) => Promise<{success: boolean, message: string}>;

  // Settings functions
  updateSettings: (settings: Partial<Settings>) => Promise<void>;

  // Notification functions
  enableNotifications: () => Promise<{ success: boolean; message: string }>;

  // PWA Install Prompt
  installPrompt: any;
  triggerInstallPrompt: () => void;
}

const defaultStatuses: SettingCategory[] = [
    { id: '1', name: 'Solicitado' },
    { id: '2', name: 'Agendado' },
    { id: '3', name: 'Em Andamento' },
    { id: '4', name: 'Concluído' },
    { id: '5', name: 'Pendente' },
    { id: '6', name: 'Finalizado' },
];

const initialSettings: Settings = {
    appName: 'GestorPRO',
    logoUrl: null,
    requesters: [],
    demands: [],
    inspectionTypes: [],
    patios: [],
    statuses: defaultStatuses,
    financialCategories: [],
    services: [],
    enableSoundAlert: true,
    enableVibrationAlert: true,
    masterPassword: '002219',
};

const initialPageNotifications: Record<Page, boolean> = {
    'Dashboard': false, 'Agendamentos': false, 'Pendências': false, 'Novas Solicitações': false,
    'Relatórios': false, 'Usuários': false, 'Configurações': false, 'Meu Perfil': false, 'Financeiro': false
};

export const AppContext = createContext<AppContextType>({
  theme: 'light', toggleTheme: () => {}, setTheme: () => {}, themePalette: 'blue', setThemePalette: () => {},
  textPalette: 'gray', setTextPalette: () => {}, user: null, users: [], appointments: [], pendencies: [], financials: [], accounts: [], thirdParties: [],
  settings: initialSettings, logo: null, updateLogo: async () => {}, loading: true, notification: null,
  clearNotification: () => {}, triggerNotification: () => {}, pageNotifications: initialPageNotifications, clearPageNotification: () => {},
  login: async () => ({ success: false, message: 'Função de login não implementada.' }), logout: () => {},
  sendPasswordReset: async () => ({ success: false, message: 'Não implementado' }),
  activePage: 'Agendamentos', setActivePage: () => {}, activeFinancialPage: 'Dashboard', setActiveFinancialPage: () => {},
  addAppointment: async () => Promise.resolve(),
  updateAppointment: async () => Promise.resolve(), deleteAppointment: async () => Promise.resolve(),
  batchAddAppointments: async () => Promise.resolve(), batchDeleteAppointments: async () => Promise.resolve(), addMessageToAppointment: async () => Promise.resolve(),
  addPendency: async () => Promise.resolve(), updatePendency: async () => Promise.resolve(),
  deletePendency: async () => Promise.resolve(), 
  addFinancial: async () => Promise.resolve(), updateFinancial: async () => Promise.resolve(), deleteFinancial: async () => Promise.resolve(),
  addAccount: async () => Promise.resolve(), updateAccount: async () => Promise.resolve(), deleteAccount: async () => Promise.resolve(),
  addThirdParty: async () => Promise.resolve(), updateThirdParty: async () => Promise.resolve(), deleteThirdParty: async () => Promise.resolve(),
  addUser: async () => ({success: false, message: 'Não implementado'}),
  updateUser: async () => Promise.resolve(), updateUserPhoto: async () => Promise.resolve(),
  deleteUser: async () => Promise.resolve(), updatePassword: async () => ({success: false, message: 'Não implementado'}),
  resetPassword: async () => ({success: false, message: 'Não implementado'}), updateSettings: async () => Promise.resolve(),
  enableNotifications: async () => ({ success: false, message: 'Não implementado' }),
  installPrompt: null,
  triggerInstallPrompt: () => {},
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [themePalette, setThemePalette] = useState<ThemePalette>(() => (localStorage.getItem('themePalette') as ThemePalette) || 'blue');
  const [textPalette, setTextPalette] = useState<TextPalette>(() => (localStorage.getItem('textPalette') as TextPalette) || 'gray');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [financials, setFinancials] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<Page>('Agendamentos');
  const [activeFinancialPage, setActiveFinancialPage] = useState<FinancialPage>('Dashboard');
  const [notification, setNotification] = useState<string | null>(null);
  const [pageNotifications, setPageNotifications] = useState<Record<Page, boolean>>(initialPageNotifications);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Ref to hold the current appointments state to avoid stale closures in listeners
  const appointmentsRef = useRef(appointments);
  useEffect(() => {
      appointmentsRef.current = appointments;
  }, [appointments]);
  const initialLoadComplete = useRef(false);
  const notificationTimeoutRef = useRef<number | null>(null);
  const firestoreUnsubscribers = useRef<(() => void)[]>([]);
  
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const clearNotification = () => setNotification(null);
  const clearPageNotification = (page: Page) => { setPageNotifications(prev => ({ ...prev, [page]: false })); };
  
  const playSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.error("Could not play sound:", e);
    }
  };

  const triggerVibration = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const triggerNotification = (message: string = "O sistema foi atualizado com novas informações!") => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      
      setNotification(message);
      
      // Note: Sound and vibration for foreground notifications may be blocked by modern mobile browsers'
      // autoplay policies, as they often require a direct user gesture (like a tap).
      // Background notifications handled by the service worker are more reliable for this.
      if (settings.enableSoundAlert) playSound();
      if (settings.enableVibrationAlert) triggerVibration();
  };
  
  // --- PWA Install Prompt Logic ---
  useEffect(() => {
      const beforeInstallHandler = (e: Event) => {
        e.preventDefault();
        console.log("beforeinstallprompt event fired.");
        setInstallPrompt(e);
      };
      
      const appInstalledHandler = () => {
        console.log("PWA was installed.");
        // Clear the install prompt so the button disappears
        setInstallPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', beforeInstallHandler);
      window.addEventListener('appinstalled', appInstalledHandler);

      return () => {
        window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
        window.removeEventListener('appinstalled', appInstalledHandler);
      };
    }, []);

    const triggerInstallPrompt = async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setInstallPrompt(null); // The prompt can only be used once.
    };

  // --- Core App Logic ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        firestoreUnsubscribers.current.forEach(unsub => unsub());
        firestoreUnsubscribers.current = [];

        if (firebaseUser) {
            try {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                let userProfile: User;

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const defaultPermissions = {
                        dashboard: 'hidden', appointments: 'hidden', pendencies: 'hidden',
                        newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'hidden',
                        financial: 'hidden',
                    };
                    userProfile = {
                        id: userDoc.id,
                        ...data,
                        roles: data.roles || [], // Ensure roles is an array
                        permissions: { ...defaultPermissions, ...(data.permissions || {}) }, // Ensure permissions object and all its keys exist
                    } as User;
                } else {
                    console.warn(`User profile not found for UID ${firebaseUser.uid}. Creating a default profile.`);
                    const defaultUser: Omit<User, 'id'> = {
                        name: firebaseUser.displayName || firebaseUser.email || 'Novo Usuário',
                        email: firebaseUser.email!,
                        roles: ['inspector'],
                        permissions: {
                            dashboard: 'view', appointments: 'update', pendencies: 'update',
                            newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'update',
                            financial: 'hidden',
                        }
                    };
                    await setDoc(userDocRef, defaultUser);
                    userProfile = { id: firebaseUser.uid, ...defaultUser };
                }
                
                setUser(userProfile);

                const unsubs: (() => void)[] = [];

                // Real-time listener for the currently logged-in user's profile
                unsubs.push(onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const defaultPermissions = {
                            dashboard: 'hidden', appointments: 'hidden', pendencies: 'hidden',
                            newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'hidden',
                            financial: 'hidden',
                        };
                        const updatedUserProfile = {
                            id: docSnap.id,
                            ...data,
                            roles: data.roles || [],
                            permissions: { ...defaultPermissions, ...(data.permissions || {}) },
                        } as User;
                        setUser(updatedUserProfile);
                    }
                }));
                
                const settingsDocRef = doc(db, "settings", "default");
                const settingsDoc = await getDoc(settingsDocRef);
                const initialSettingsData = settingsDoc.exists() ? { ...initialSettings, ...settingsDoc.data() } : initialSettings;

                unsubs.push(onSnapshot(settingsDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const settingsData = docSnap.data();
                        if (!settingsData.masterPassword) {
                            // Initialize master password if it doesn't exist
                            updateSettings({ masterPassword: '002219' });
                        }
                        setSettings({ ...initialSettings, ...settingsData, id: docSnap.id });
                    } else if (userProfile.permissions.settings === 'edit') {
                        setDoc(settingsDocRef, initialSettings);
                    } else {
                        setSettings(initialSettings);
                    }
                }));
                
                if (userProfile.roles.includes('master') || userProfile.roles.includes('admin')) {
                    unsubs.push(onSnapshot(collection(db, "users"), (snapshot) => setUsers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User)))));
                } else if (userProfile.roles.includes('client')) {
                    // For clients, fetch only admin and master users so they can assign pendencies.
                    const usersQuery = query(collection(db, "users"), where("roles", "array-contains-any", ["admin", "master"]));
                    unsubs.push(onSnapshot(usersQuery, (snapshot) => {
                        setUsers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User)));
                    }));
                }
            
                if (userProfile.permissions.appointments !== 'hidden') {
                    let queryRef: any;
                    if (userProfile.roles.includes('master') || userProfile.roles.includes('admin')) {
                        queryRef = collection(db, "appointments");
                    } else if (userProfile.roles.includes('inspector')) {
                        queryRef = query(collection(db, "appointments"), where("inspectorId", "==", userProfile.id));
                    } else if (userProfile.roles.includes('client') && userProfile.requesterId) {
                        const clientRequester = initialSettingsData.requesters.find(r => r.id === userProfile.requesterId);
                        if (clientRequester) {
                            queryRef = query(collection(db, "appointments"), where("requester", "==", clientRequester.name));
                        } else {
                            console.warn(`Client user has invalid requesterId. No appointments will be shown.`);
                            setAppointments([]);
                        }
                    }
                    if (queryRef) {
                        unsubs.push(onSnapshot(queryRef, (snapshot) => {
                            const newAppointments = snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Appointment));

                            if (initialLoadComplete.current && snapshot.docChanges().length > 0) {
                                let hasNewRequest = false;
                                let hasNewAppointment = false;
                                
                                snapshot.docChanges().forEach((change) => {
                                    const data = change.doc.data();
                                    const oldAppointment = appointmentsRef.current.find(a => a.stringId === change.doc.id);

                                    if (change.type === "added") {
                                        if (data.status === 'Solicitado') {
                                            hasNewRequest = true;
                                        } else if (data.status !== 'Solicitado') {
                                            hasNewAppointment = true;
                                        }
                                    } else if (change.type === "modified") {
                                        if (oldAppointment && oldAppointment.status === 'Solicitado' && data.status !== 'Solicitado') {
                                            hasNewAppointment = true;
                                        }
                                    }
                                });
                                
                                if (hasNewRequest && hasNewAppointment) {
                                    setPageNotifications(prev => ({...prev, 'Novas Solicitações': true, 'Agendamentos': true}));
                                    triggerNotification("Novas solicitações e agendamentos recebidos!");
                                } else if (hasNewRequest) {
                                    setPageNotifications(prev => ({...prev, 'Novas Solicitações': true}));
                                    triggerNotification("Nova(s) solicitação(ões) recebida(s)!");
                                } else if (hasNewAppointment) {
                                    setPageNotifications(prev => ({...prev, 'Agendamentos': true}));
                                    triggerNotification("Novo(s) agendamento(s) para vistoria!");
                                } else {
                                    triggerNotification();
                                }
                            }
                            
                            setAppointments(newAppointments);

                        }, (error) => console.error("Appointment snapshot error:", error) ));
                    }
                }
            
                if (userProfile.permissions.pendencies !== 'hidden') {
                    let queryRef: any;
                    if (userProfile.roles.includes('master') || userProfile.roles.includes('admin') || userProfile.roles.includes('client')) {
                        // For Master, Admin, and Client roles, fetch all pendencies.
                        // Client-side filtering in `Pendent.tsx` will handle visibility for clients.
                        queryRef = collection(db, "pendencies");
                    } else if (userProfile.roles.includes('inspector')) {
                        queryRef = query(collection(db, "pendencies"), where("responsibleId", "==", userProfile.id));
                    }

                    if (queryRef) {
                        unsubs.push(onSnapshot(queryRef, (snapshot) => {
                            setPendencies(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Pendency)));
                            if (initialLoadComplete.current) {
                                let hasNewPendency = false;
                                snapshot.docChanges().forEach((change) => {
                                    if (change.type === "added") {
                                        hasNewPendency = true;
                                    }
                                });
                                if (hasNewPendency) {
                                    setPageNotifications(prev => ({...prev, 'Pendências': true}));
                                    triggerNotification("Nova(s) pendência(s) registrada(s)!");
                                } else {
                                    triggerNotification();
                                }
                            }
                        }, (error) => console.error("Pendency snapshot error:", error)));
                    }
                }

                if (userProfile.permissions.financial !== 'hidden') {
                    unsubs.push(onSnapshot(collection(db, "financials"), (snapshot) => {
                        setFinancials(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialTransaction)));
                        if (initialLoadComplete.current) triggerNotification();
                    }, (error) => console.error("Financials snapshot error:", error)));

                    unsubs.push(onSnapshot(collection(db, "accounts"), (snapshot) => {
                        setAccounts(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialAccount)));
                         if (initialLoadComplete.current) triggerNotification();
                    }, (error) => console.error("Accounts snapshot error:", error)));
                    
                    unsubs.push(onSnapshot(collection(db, "thirdParties"), (snapshot) => {
                        setThirdParties(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as ThirdParty)));
                         if (initialLoadComplete.current) triggerNotification();
                    }, (error) => console.error("ThirdParties snapshot error:", error)));
                }

                firestoreUnsubscribers.current = unsubs;

            } catch (err) {
                console.error("Failed to set up user session, signing out:", err);
                await signOut(auth);
            } finally {
                setLoading(false);
                initialLoadComplete.current = true;
            }
        } else {
            setUser(null);
            setUsers([]);
            setAppointments([]);
            setPendencies([]);
            setFinancials([]);
            setAccounts([]);
            setThirdParties([]);
            
            // Add a listener for settings specifically for the login page
            const unsubSettingsForLogin = onSnapshot(doc(db, "settings", "default"), (docSnap) => {
                if (docSnap.exists()) {
                    setSettings({ ...initialSettings, ...docSnap.data(), id: docSnap.id });
                } else {
                    setSettings(initialSettings);
                }
            });
            firestoreUnsubscribers.current.push(unsubSettingsForLogin);
            
            setLoading(false);
            initialLoadComplete.current = true;
        }
    });
    
    return () => {
        unsubAuth();
        firestoreUnsubscribers.current.forEach(unsub => unsub());
        if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);
  
  // Apply theme to document and save to localStorage
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.palette = themePalette;
    localStorage.setItem('themePalette', themePalette);
  }, [themePalette]);

  useEffect(() => {
    document.documentElement.dataset.textPalette = textPalette;
    localStorage.setItem('textPalette', textPalette);
  }, [textPalette]);

  const updateSettings = async (updatedSettings: Partial<Settings>) => {
      try {
        await setDoc(doc(db, "settings", "default"), updatedSettings, { merge: true });
      } catch (error) {
        console.error("Error updating settings: ", error);
        triggerNotification("Falha ao salvar as configurações.");
      }
  };
  
  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return { success: true, message: 'Login bem-sucedido!' };
      } catch (error: any) {
          let message = 'Ocorreu um erro desconhecido.';
          if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code)) {
              message = 'E-mail ou senha incorretos.';
          } else if (error.code === 'auth/configuration-not-found') {
              message = 'Erro de configuração. Verifique se o método de login por E-mail/Senha está ativo no Firebase.';
          }
          console.error("Login error:", error.code);
          return { success: false, message };
      }
  };
  
  const logout = async () => {
      await signOut(auth);
      setActivePage('Agendamentos');
  };
  
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
      try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: `E-mail de redefinição de senha enviado para ${email}.`};
      } catch (error: any) {
        console.error("Password reset error:", error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, message: 'Nenhum usuário encontrado com este e-mail.' };
        }
        return { success: false, message: 'Ocorreu um erro ao enviar o e-mail de redefinição.' };
      }
  };

  const updateLogo = async (newLogoUrl: string | null) => { await updateSettings({ logoUrl: newLogoUrl }); };
  const addAppointment = async (appointment: Omit<Appointment, 'id' | 'stringId'>) => { try { await addDoc(collection(db, "appointments"), appointment); } catch (e) { console.error(e); triggerNotification("Erro ao adicionar agendamento.")} };
  const batchAddAppointments = async (appointmentsToAdd: Omit<Appointment, 'id' | 'stringId'>[]) => {
      try {
          const batch = writeBatch(db);
          appointmentsToAdd.forEach(app => {
              const docRef = doc(collection(db, "appointments"));
              batch.set(docRef, app);
          });
          await batch.commit();
      } catch (e) { console.error(e); triggerNotification("Erro ao adicionar agendamentos em lote.")}
  };
  const updateAppointment = async (updatedAppointment: Appointment) => {
      if (!updatedAppointment.stringId) return;
      try {
        const { id, stringId, ...data } = updatedAppointment;
        await updateDoc(doc(db, "appointments", stringId), data);
      } catch (e) { console.error(e); triggerNotification("Erro ao atualizar agendamento.")}
  };
  const deleteAppointment = async (stringId: string) => {
      if (stringId) {
          try { await deleteDoc(doc(db, "appointments", stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir agendamento.")}
      }
  };
  const batchDeleteAppointments = async (stringIds: string[]) => {
    try {
        const batch = writeBatch(db);
        stringIds.forEach(id => {
            const docRef = doc(db, "appointments", id);
            batch.delete(docRef);
        });
        await batch.commit();
    } catch (e) { console.error(e); triggerNotification("Erro ao excluir agendamentos.")}
  };
  const addPendency = async (pendency: Omit<Pendency, 'id' | 'stringId'>) => { try { await addDoc(collection(db, "pendencies"), pendency); } catch (e) { console.error(e); triggerNotification("Erro ao adicionar pendência.")} };
  const updatePendency = async (updatedPendency: Pendency) => {
      if (!updatedPendency.stringId) return;
      try {
          const { id, stringId, ...data } = updatedPendency;
          await updateDoc(doc(db, "pendencies", stringId), data);
      } catch (e) { console.error(e); triggerNotification("Erro ao atualizar pendência.")}
  };
  const deletePendency = async (id: number) => {
      const pendencyToDelete = pendencies.find(p => p.id === id);
      if (pendencyToDelete && pendencyToDelete.stringId) {
          try { await deleteDoc(doc(db, "pendencies", pendencyToDelete.stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir pendência.")}
      }
  };
  const addMessageToAppointment = async (appointmentStringId: string, messageText: string) => {
      if (!user) return;
      try {
        const newMessage: Message = { authorId: user.id, authorName: user.name, text: messageText, timestamp: Date.now() };
        await updateDoc(doc(db, "appointments", appointmentStringId), { messages: arrayUnion(newMessage) });
      } catch (e) { console.error(e); triggerNotification("Erro ao enviar mensagem.")}
  };
  
  const addFinancial = async (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => { try { await addDoc(collection(db, "financials"), transaction); } catch (e) { console.error(e); triggerNotification("Erro ao adicionar transação.")} };
  const updateFinancial = async (updatedTransaction: FinancialTransaction) => {
      if (!updatedTransaction.stringId) return;
      try {
        const { id, stringId, ...data } = updatedTransaction;
        await updateDoc(doc(db, "financials", stringId), data);
      } catch (e) { console.error(e); triggerNotification("Erro ao atualizar transação.")}
  };
  const deleteFinancial = async (id: number) => {
      const transactionToDelete = financials.find(f => f.id === id);
      if (transactionToDelete && transactionToDelete.stringId) {
          try { await deleteDoc(doc(db, "financials", transactionToDelete.stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir transação.")}
      }
  };

  const addAccount = async (account: Omit<FinancialAccount, 'id' | 'stringId'>) => { try { await addDoc(collection(db, "accounts"), account); } catch (e) { console.error(e); triggerNotification("Erro ao adicionar conta.")} };
  const updateAccount = async (updatedAccount: FinancialAccount) => {
      if (!updatedAccount.stringId) return;
      try {
        const { id, stringId, ...data } = updatedAccount;
        await updateDoc(doc(db, "accounts", stringId), data);
      } catch (e) { console.error(e); triggerNotification("Erro ao atualizar conta.")}
  };
  const deleteAccount = async (id: number) => {
      const accountToDelete = accounts.find(a => a.id === id);
      if (accountToDelete && accountToDelete.stringId) {
          try { await deleteDoc(doc(db, "accounts", accountToDelete.stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir conta.")}
      }
  };

  const addThirdParty = async (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => { try { await addDoc(collection(db, "thirdParties"), thirdParty); } catch (e) { console.error(e); triggerNotification("Erro ao adicionar cliente/fornecedor.")} };
  const updateThirdParty = async (updatedThirdParty: ThirdParty) => {
      if (!updatedThirdParty.stringId) return;
      try {
          const { id, stringId, ...data } = updatedThirdParty;
          await updateDoc(doc(db, "thirdParties", stringId), data);
      } catch (e) { console.error(e); triggerNotification("Erro ao atualizar cliente/fornecedor.")}
  };
  const deleteThirdParty = async (id: number) => {
      const toDelete = thirdParties.find(a => a.id === id);
      if (toDelete && toDelete.stringId) {
          try { await deleteDoc(doc(db, "thirdParties", toDelete.stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir cliente/fornecedor.")}
      }
  };

  const addUser = async (userData: Omit<User, 'id'>): Promise<{success: boolean, message: string}> => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, '123mudar');
        const userDataWithFlag = { ...userData, forcePasswordChange: true };
        await setDoc(doc(db, "users", userCredential.user.uid), userDataWithFlag);
        
        triggerNotification(`Usuário ${userData.name} criado. O sistema fará o logout do administrador para concluir.`);
        setTimeout(async () => {
            await logout();
        }, 3000);

        return { success: true, message: 'Usuário criado com sucesso. Você será desconectado.'};
      } catch (error: any) {
        console.error("Add user error:", error);
        if (error.code === 'auth/email-already-in-use') {
            return { success: false, message: 'Este e-mail já está em uso por outra conta.' };
        }
        return { success: false, message: 'Ocorreu um erro ao criar o usuário.' };
      }
  };
  
  const updateUser = async (updatedUser: User) => { try { await updateDoc(doc(db, "users", updatedUser.id), updatedUser); } catch (e) { console.error(e); triggerNotification("Erro ao atualizar usuário.")} };
  const updateUserPhoto = async (userId: string, photoURL: string) => { try { await updateDoc(doc(db, "users", userId), { photoURL }); } catch (e) { console.error(e); triggerNotification("Erro ao atualizar foto.")} };
  const deleteUser = async (id: string) => {
      try { await deleteDoc(doc(db, "users", id)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir usuário.")}
  };
  
  const updatePassword = async (oldPass: string, newPass: string): Promise<{success: boolean, message: string}> => {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) return { success: false, message: 'Usuário não autenticado corretamente.' };
      
      try {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPass);
        await reauthenticateWithCredential(currentUser, credential);
        await fbUpdatePassword(currentUser, newPass);

        // After successful password change, turn off the force change flag.
        if (user?.forcePasswordChange) {
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, { forcePasswordChange: false });
        }

        return { success: true, message: 'Senha alterada com sucesso!' };
      } catch (error: any) {
        console.error("Password update error:", error);
        if (['auth/wrong-password', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code)) {
            return { success: false, message: 'Senha atual incorreta.' };
        }
        return { success: false, message: 'Erro ao alterar a senha.'};
      }
  };
  
  const resetPassword = async (email: string): Promise<{success: boolean, message: string}> => {
     return sendPasswordReset(email);
  };

  const enableNotifications = async (): Promise<{ success: boolean; message: string; }> => {
    if (!messaging || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return { success: false, message: "Este navegador não suporta notificações push." };
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const vapidKey = "BA2VwLLat-2Uv7Z5soT_T0soxy_DwISv2g0-app7QGgL4DqL42kE6wLg2Y2m3Y9J5N4p6e1c9m6f1R0h9k8l1v4"; // Substitua!
            const token = await getToken(messaging, { vapidKey });

            if (token && user) {
                await updateDoc(doc(db, "users", user.id), { fcmToken: token });
                return { success: true, message: "Notificações ativadas com sucesso!" };
            } else if (!user) {
                return { success: false, message: "Usuário não está logado para salvar o token." };
            } else {
                return { success: false, message: "Não foi possível obter o token de notificação." };
            }
        } else if (permission === 'denied') {
            return { success: false, message: "Permissão para notificações foi negada. Você precisa habilitá-las nas configurações do navegador." };
        } else {
            return { success: false, message: "Permissão para notificações não foi concedida." };
        }
    } catch (error) {
        console.error('Ocorreu um erro ao habilitar as notificações: ', error);
        return { success: false, message: "Ocorreu um erro ao habilitar as notificações." };
    }
  };

  return (
    <AppContext.Provider value={{ 
        theme, toggleTheme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
        user, users, appointments, pendencies, financials, accounts, thirdParties, settings, logo: settings.logoUrl || null, updateLogo, loading,
        notification, clearNotification, triggerNotification, pageNotifications, clearPageNotification,
        login, logout, sendPasswordReset,
        activePage, setActivePage, activeFinancialPage, setActiveFinancialPage,
        addAppointment, updateAppointment, deleteAppointment, batchAddAppointments, batchDeleteAppointments, addMessageToAppointment,
        addPendency, updatePendency, deletePendency,
        addFinancial, updateFinancial, deleteFinancial,
        addAccount, updateAccount, deleteAccount,
        addThirdParty, updateThirdParty, deleteThirdParty,
        addUser, updateUser, updateUserPhoto, deleteUser, updatePassword, resetPassword,
        updateSettings, enableNotifications,
        installPrompt, triggerInstallPrompt
    }}>
      {children}
    </AppContext.Provider>
  );
};