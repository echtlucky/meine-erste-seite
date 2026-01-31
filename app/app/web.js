/**
 * LCKY HUB - Firebase Configuration & Authentication v2.0
 * Production-ready with proper initialization and error handling
 */

(function() {
    'use strict';

    // Firebase Configuration
    const firebaseConfig = window.LCKY_FIREBASE_CONFIG || {
        apiKey: "REPLACE_WITH_API_KEY",
        authDomain: "echtlucky-blog.firebaseapp.com",
        projectId: "echtlucky-blog",
        storageBucket: "echtlucky-blog.appspot.com",
        messagingSenderId: "411123885314",
        appId: "1:411123885314:web:869d4cfabaaea3849d0e1b"
    };

    // State
    let app = null;
    let auth = null;
    let db = null;
    let isFirebaseInitialized = false;
    let isDemoMode = false;
    let initializationPromise = null;

    // ============================================
    // INITIALIZATION
    // ============================================

    function initFirebase() {
        if (initializationPromise) return initializationPromise;
        
        initializationPromise = new Promise((resolve) => {
            if (isFirebaseInitialized) {
                resolve();
                return;
            }

            try {
                // Check if Firebase SDK is loaded
                if (typeof firebase === 'undefined') {
                    console.log('Firebase SDK not loaded, using demo mode');
                    isDemoMode = true;
                    resolve();
                    return;
                }

                // Check if config is valid
                if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || firebaseConfig.apiKey === "REPLACE_WITH_API_KEY") {
                    console.log('Firebase: Using demo mode (config not set)');
                    isDemoMode = true;
                    resolve();
                    return;
                }

                // Initialize Firebase
                app = firebase.initializeApp(firebaseConfig);
                auth = firebase.auth();
                db = firebase.firestore();
                isFirebaseInitialized = true;

                // Configure auth settings
                auth.useDeviceLanguage();

                // Configure persistence
                auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

                console.log('Firebase initialized successfully');
                resolve();
            } catch (error) {
                console.error('Firebase init error:', error);
                isDemoMode = true;
                resolve();
            }
        });

        return initializationPromise;
    }

    // Initialize immediately if Firebase SDK is available
    if (typeof firebase !== 'undefined') {
        initFirebase();
    }

    // ============================================
    // AUTH API
    // ============================================

    window.firebaseAuth = {
        // Initialize and wait for Firebase
        ready: function() {
            return initFirebase();
        },

        // Check if using demo mode
        isDemoMode: function() {
            return isDemoMode;
        },

        // Get current user
        getCurrentUser: function() {
            if (isDemoMode) {
                const session = localStorage.getItem('lucky_hub_session');
                return session ? JSON.parse(session) : null;
            }
            return auth?.currentUser || null;
        },

        // Sign in with email or username and password
        signInWithEmailAndPassword: function(identifier, password) {
            return new Promise((resolve, reject) => {
                // Wait for Firebase to be ready
                this.ready().then(async () => {
                    if (isDemoMode) {
                        // Demo mode - accept any credentials
                        if (!identifier || !password) {
                            reject(new Error('loginErrorEmpty'));
                            return;
                        }
                        
                        if (password.length < 6) {
                            reject(new Error('loginErrorPassword'));
                            return;
                        }
                        
                        const displayName = identifier.includes('@')
                            ? identifier.split('@')[0]
                            : identifier;
                        
                        const userData = {
                            uid: 'demo_' + Date.now(),
                            email: identifier.includes('@') ? identifier : `${identifier}@demo.local`,
                            displayName: displayName,
                            photoURL: null
                        };
                        
                        localStorage.setItem('lucky_hub_session', JSON.stringify({
                            ...userData,
                            username: displayName,
                            discriminator: Math.floor(1000 + Math.random() * 9000),
                            avatar: null,
                            avatarColor: '#8B5CF6',
                            initial: displayName.charAt(0).toUpperCase(),
                            status: 'online',
                            role: 'user',
                            createdAt: Date.now()
                        }));
                        
                        resolve(userData);
                        return;
                    }

                    if (!identifier || !password) {
                        reject(new Error('loginErrorEmpty'));
                        return;
                    }

                    let email = identifier.trim();
                    if (!email.includes('@')) {
                        const usernameKey = email.toLowerCase();
                        const usernameDoc = await db.collection('usernames').doc(usernameKey).get();
                        if (!usernameDoc.exists) {
                            reject(this.getErrorMessage('loginErrorNotFound'));
                            return;
                        }
                        email = usernameDoc.data().email;
                    }
                    
                    // Real Firebase auth
                    auth.signInWithEmailAndPassword(email, password)
                        .then((userCredential) => {
                            const user = userCredential.user;
                            resolve(user);
                        })
                        .catch((error) => {
                            reject(this.getErrorMessage(error.code || error.message));
                        });
                }).catch((error) => {
                    reject(this.getErrorMessage(error.message || 'initError'));
                });
            });
        },

        // Sign up with email and password
        createUserWithEmailAndPassword: function(email, password, username) {
            return new Promise((resolve, reject) => {
                this.ready().then(async () => {
                    if (isDemoMode) {
                        // Demo mode
                        if (!email || !password || !username) {
                            reject(new Error('registerErrorEmpty'));
                            return;
                        }
                        
                        if (password.length < 6) {
                            reject(new Error('registerErrorPassword'));
                            return;
                        }
                        
                        if (username.length < 3) {
                            reject(new Error('registerErrorUsername'));
                            return;
                        }
                        
                        const userData = {
                            uid: 'demo_' + Date.now(),
                            email: email,
                            displayName: username,
                            photoURL: null
                        };
                        
                        localStorage.setItem('lucky_hub_session', JSON.stringify({
                            ...userData,
                            username: username,
                            discriminator: Math.floor(1000 + Math.random() * 9000),
                            avatar: null,
                            avatarColor: '#8B5CF6',
                            initial: username.charAt(0).toUpperCase(),
                            status: 'online',
                            role: 'user',
                            createdAt: Date.now()
                        }));
                        
                        resolve(userData);
                        return;
                    }

                    if (!email || !password || !username) {
                        reject(new Error('registerErrorEmpty'));
                        return;
                    }

                    const usernameKey = username.trim().toLowerCase();
                    const usernameRef = db.collection('usernames').doc(usernameKey);
                    const usernameSnapshot = await usernameRef.get();
                    if (usernameSnapshot.exists) {
                        reject(this.getErrorMessage('registerErrorUsernameTaken'));
                        return;
                    }
                    
                    // Real Firebase auth
                    auth.createUserWithEmailAndPassword(email, password)
                        .then(async (userCredential) => {
                            const user = userCredential.user;
                            
                            // Update display name
                            await user.updateProfile({ displayName: username });
                            
                            // Create user document in Firestore
                            await db.collection('users').doc(user.uid).set({
                                uid: user.uid,
                                email: email,
                                username: username,
                                displayName: username,
                                role: 'user',
                                status: 'active',
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });

                            await usernameRef.set({
                                uid: user.uid,
                                email: email,
                                username: username,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            resolve(user);
                        })
                        .catch((error) => {
                            reject(this.getErrorMessage(error.code || error.message));
                        });
                }).catch((error) => {
                    reject(this.getErrorMessage(error.message || 'initError'));
                });
            });
        },

        // Sign out
        signOut: function() {
            return new Promise((resolve, reject) => {
                this.ready().then(() => {
                    if (isDemoMode) {
                        localStorage.removeItem('lucky_hub_session');
                        resolve();
                        return;
                    }
                    
                    auth.signOut()
                        .then(() => {
                            localStorage.removeItem('lucky_hub_session');
                            resolve();
                        })
                        .catch((error) => {
                            reject(this.getErrorMessage(error.code || error.message));
                        });
                }).catch((error) => {
                    reject(this.getErrorMessage(error.message || 'initError'));
                });
            });
        },

        // Send password reset email
        sendPasswordResetEmail: function(identifier) {
            return new Promise((resolve, reject) => {
                this.ready().then(async () => {
                    if (isDemoMode) {
                        resolve();
                        return;
                    }

                    if (!identifier) {
                        reject(this.getErrorMessage('loginErrorEmpty'));
                        return;
                    }

                    let email = identifier.trim();
                    if (!email.includes('@')) {
                        const usernameKey = email.toLowerCase();
                        const usernameDoc = await db.collection('usernames').doc(usernameKey).get();
                        if (!usernameDoc.exists) {
                            reject(this.getErrorMessage('loginErrorNotFound'));
                            return;
                        }
                        email = usernameDoc.data().email;
                    }
                    
                    auth.sendPasswordResetEmail(email)
                        .then(() => resolve())
                        .catch((error) => reject(this.getErrorMessage(error.code || error.message)));
                }).catch((error) => {
                    reject(this.getErrorMessage(error.message || 'initError'));
                });
            });
        },

        // Get error message - human readable
        getErrorMessage: function(error) {
            // Map Firebase error codes to user-friendly messages
            const errorMessages = {
                // Login errors
                'auth/user-not-found': 'loginErrorNotFound',
                'auth/wrong-password': 'loginErrorWrongPassword',
                'auth/invalid-email': 'loginErrorInvalidEmail',
                'auth/user-disabled': 'loginErrorDisabled',
                'auth/too-many-requests': 'loginErrorTooMany',
                'auth/network-request-failed': 'loginErrorNetwork',
                
                // Register errors
                'auth/email-already-in-use': 'registerErrorEmailExists',
                'auth/weak-password': 'registerErrorWeakPassword',
                'auth/operation-not-allowed': 'registerErrorNotAllowed',
                'auth/invalid-password': 'registerErrorInvalidPassword',
                'registerErrorUsernameTaken': 'registerErrorUsernameTaken',
                
                // Generic/Other
                'auth/popup-closed-by-user': 'errorPopupClosed',
                'auth/cancelled-popup-request': 'errorPopupRequest',
                'auth/credential-already-in-use': 'errorCredentialInUse',
                'auth/requires-recent-login': 'errorRecentLogin',
                
                // Custom errors from demo mode
                'loginErrorEmpty': 'loginErrorEmpty',
                'loginErrorPassword': 'loginErrorPassword',
                'registerErrorEmpty': 'registerErrorEmpty',
                'registerErrorPassword': 'registerErrorPassword',
                'registerErrorUsername': 'registerErrorUsername',
                'initError': 'initError',
                
                // Fallback
                'default': 'errorGeneric'
            };
            
            return errorMessages[error] || errorMessages['default'] || 'errorGeneric';
        },

        // Get user session data
        getSessionData: function() {
            return new Promise((resolve) => {
                if (isDemoMode) {
                    const session = localStorage.getItem('lucky_hub_session');
                    resolve(session ? JSON.parse(session) : null);
                    return;
                }
                
                const user = auth?.currentUser;
                if (!user) {
                    resolve(null);
                    return;
                }
                
                // Get additional user data from Firestore
                db.collection('users').doc(user.uid).get()
                    .then((doc) => {
                        if (doc.exists) {
                            resolve({ uid: user.uid, ...doc.data() });
                        } else {
                            resolve({
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName,
                                username: user.displayName || '',
                                role: 'user',
                                photoURL: user.photoURL
                            });
                        }
                    })
                    .catch(() => {
                        resolve({
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            username: user.displayName || '',
                            role: 'user',
                            photoURL: user.photoURL
                        });
                    });
            });
        }
    };

    // ============================================
    // FIRESTORE API
    // ============================================

    window.firebaseDb = {
        // Add document
        add: function(collection, data) {
            if (!isFirebaseInitialized || isDemoMode) {
                console.log('Firestore: Demo mode, data not saved');
                return Promise.resolve({ id: 'demo_' + Date.now() });
            }
            
            return db.collection(collection).add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        },

        // Get document
        get: function(collection, id) {
            if (!isFirebaseInitialized || isDemoMode) {
                return Promise.resolve(null);
            }
            
            return db.collection(collection).doc(id).get();
        },

        // Update document
        update: function(collection, id, data) {
            if (!isFirebaseInitialized || isDemoMode) {
                return Promise.resolve();
            }
            
            return db.collection(collection).doc(id).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        },

        // Query collection
        query: function(collection, conditions) {
            if (!isFirebaseInitialized || isDemoMode) {
                return Promise.resolve({ empty: true, docs: [] });
            }
            
            let ref = db.collection(collection);
            
            conditions.forEach(condition => {
                ref = ref.where(condition.field, condition.operator, condition.value);
            });
            
            return ref.get();
        },

        // Listen to document changes
        listen: function(collection, id, callback) {
            if (!isFirebaseInitialized || isDemoMode) {
                return () => {};
            }
            
            return db.collection(collection).doc(id).onSnapshot(callback);
        },

        // Listen to collection changes
        listenCollection: function(collection, callback) {
            if (!isFirebaseInitialized || isDemoMode) {
                return () => {};
            }
            
            return db.collection(collection).onSnapshot(callback);
        }
    };

    // ============================================
    // CHAT API
    // ============================================

    window.luckyChat = {
        // Send message
        sendMessage: function(chatId, message) {
            const user = window.firebaseAuth.getCurrentUser();
            if (!user) return Promise.reject('errorNotLoggedIn');
            
            return window.firebaseDb.add('chats/' + chatId + '/messages', {
                content: message,
                senderId: user.uid,
                senderName: user.username || user.displayName || 'User',
                timestamp: Date.now()
            });
        },

        // Get messages
        getMessages: function(chatId) {
            if (isDemoMode) {
                // Demo data
                return Promise.resolve([
                    { id: 1, content: 'Hey! Schön dich zu sehen!', senderName: 'Soffie', timestamp: Date.now() - 60000 },
                    { id: 2, content: 'Wie gehts dir heute?', senderName: 'Soffie', timestamp: Date.now() - 30000 }
                ]);
            }
            
            return window.firebaseDb.query('chats/' + chatId + '/messages', []);
        },

        // Subscribe to messages
        subscribeMessages: function(chatId, callback) {
            return window.firebaseDb.listenCollection('chats/' + chatId + '/messages', (snapshot) => {
                const messages = [];
                snapshot.forEach((doc) => {
                    messages.push({ id: doc.id, ...doc.data() });
                });
                callback(messages);
            });
        },

        // Set typing indicator
        setTyping: function(chatId, isTyping) {
            const user = window.firebaseAuth.getCurrentUser();
            if (!user) return;
            
            const status = isTyping ? user.username || 'Jemand' : null;
            console.log('Typing:', status);
        }
    };

})();
