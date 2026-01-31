/**
 * LCKY HUB - Internationalization System
 * Supports: English (en), German (de), French (fr), Spanish (es)
 */

class I18n {
    constructor() {
        this.translations = {
            de: {
                // Login Page
                loginTitle: 'LCKY HUB - Login',
                logoAlt: 'LCKY HUB Logo',
                loginHeading: 'Willkommen zurück',
                loginSubtitle: 'Melde dich an, um fortzufahren',
                emailLabel: 'E-Mail',
                emailPlaceholder: 'E-Mail eingeben',
                passwordLabel: 'Passwort',
                passwordPlaceholder: 'Passwort eingeben',
                forgotPassword: 'Passwort vergessen?',
                loginButton: 'Anmelden',
                noAccount: 'Kein Konto? <a href="register.html">Registrieren</a>',
                
                // Register Page
                registerTitle: 'LCKY HUB - Registrieren',
                registerHeading: 'Konto erstellen',
                registerSubtitle: 'Trete LCKY HUB bei',
                usernameLabel: 'Benutzername',
                usernamePlaceholder: 'Benutzername eingeben',
                confirmPasswordLabel: 'Passwort bestätigen',
                confirmPasswordPlaceholder: 'Passwort wiederholen',
                acceptTerms: 'Ich akzeptiere die <a href="#" onclick="showTerms(); return false;">AGB</a> und <a href="#" onclick="showPrivacy(); return false;">Datenschutz</a>',
                registerButton: 'Registrieren',
                hasAccount: 'Bereits registriert? <a href="login.html">Anmelden</a>',
                welcomeTitle: 'Willkommen bei LCKY HUB',
                welcomeMessage: 'Deine Plattform für Reflex-Training und Gaming-Community.',
                welcomeMotivational: 'Verbessere deine Reflexe, fordere Freunde heraus und erreiche neue Höchstleistungen!',

                // Common
                loading: 'Wird geladen...',
                error: 'Fehler',
                cancel: 'Abbrechen',
                confirm: 'Bestätigen',
                save: 'Speichern',
                close: 'Schließen',
                back: 'Zurück',
                next: 'Weiter',
                submit: 'Absenden',

                // Errors
                loginError: 'Anmeldung fehlgeschlagen. Bitte überprüfe deine Eingaben.',
                registerError: 'Registrierung fehlgeschlagen.',
                invalidEmail: 'Ungültige E-Mail-Adresse',
                passwordMismatch: 'Passwörter stimmen nicht überein',
                passwordTooShort: 'Passwort muss mindestens 6 Zeichen lang sein',
                invalidCredentials: 'Ungültige Anmeldedaten',
                emailRequired: 'E-Mail ist erforderlich',
                usernameRequired: 'Benutzername ist erforderlich',
                termsRequired: 'Bitte akzeptiere die AGB und Datenschutz',
                loginErrorEmpty: 'Bitte fülle alle Felder aus.',
                loginErrorPassword: 'Passwort ist falsch.',
                loginErrorNotFound: 'Benutzer nicht gefunden. Bitte registriere dich.',
                loginErrorWrongPassword: 'Falsches Passwort. Bitte versuche es erneut.',
                loginErrorInvalidEmail: 'Ungültige E-Mail-Adresse.',
                loginErrorDisabled: 'Dieses Konto wurde deaktiviert.',
                loginErrorTooMany: 'Zu viele Versuche. Bitte warte kurz.',
                loginErrorNetwork: 'Netzwerkfehler. Bitte überprüfe deine Verbindung.',
                registerErrorEmpty: 'Bitte fülle alle Felder aus.',
                registerErrorPassword: 'Passwort muss mindestens 6 Zeichen haben.',
                registerErrorUsername: 'Benutzername muss mindestens 3 Zeichen haben.',
                registerErrorEmailExists: 'Diese E-Mail wird bereits verwendet.',
                registerErrorWeakPassword: 'Passwort ist zu schwach.',
                registerErrorPasswordMatch: 'Passwörter stimmen nicht überein.',
                registerErrorTerms: 'Bitte akzeptiere die AGB und Datenschutz.',
                errorGeneric: 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.',
                errorPopupClosed: 'Vorgang abgebrochen.',
                errorPopupRequest: 'Vorgang abgebrochen.',
                errorCredentialInUse: 'Diese Anmeldedaten werden bereits verwendet.',
                errorRecentLogin: 'Bitte melde dich erneut an.',
                errorNotLoggedIn: 'Bitte melde dich zuerst an.',
                initError: 'Initialisierungsfehler.',
                successLogin: 'Anmeldung erfolgreich!',
                successRegister: 'Konto erfolgreich erstellt!',
                successPasswordReset: 'E-Mail zum Zurücksetzen des Passworts gesendet',
                termsLabel: 'Ich akzeptiere die <a href="agb.html">AGB</a> und <a href="#">Datenschutzrichtlinie</a>',
                
                // AGB / Privacy
                agbTitle: 'Allgemeine Geschäftsbedingungen',
                privacyTitle: 'Datenschutzrichtlinie',
                agbContent: `
                    <h2>1. Allgemeines</h2>
                    <p>Willkommen bei LCKY HUB. Durch die Nutzung unserer Plattform erklären Sie sich mit diesen AGB einverstanden.</p>
                    
                    <h2>2. Nutzung</h2>
                    <p>Sie verpflichten sich, die Plattform nur für legale Zwecke zu nutzen.</p>
                    
                    <h2>3. Benutzerkonto</h2>
                    <p>Sie sind verantwortlich für die Sicherheit Ihres Kontos.</p>
                    
                    <h2>4. Haftung</h2>
                    <p>Die Nutzung erfolgt auf eigene Gefahr.</p>
                `,
                privacyContent: `
                    <h2>1. Datenschutz</h2>
                    <p>Wir respektieren Ihre Privatsphäre und schützen Ihre persönlichen Daten.</p>
                    
                    <h2>2. Erhobene Daten</h2>
                    <p>Wir erheben nur die für die Nutzung notwendigen Daten.</p>
                    
                    <h2>3. Datenverwendung</h2>
                    <p>Ihre Daten werden nur für den Betrieb der Plattform verwendet.</p>
                    
                    <h2>4. Kontakt</h2>
                    <p>Bei Fragen kontaktieren Sie uns unter lucassteckel04@gmail.com</p>
                `
            },
            en: {
                // Login Page
                loginTitle: 'LCKY HUB - Login',
                logoAlt: 'LCKY HUB Logo',
                loginHeading: 'Welcome Back',
                loginSubtitle: 'Sign in to continue to LCKY HUB',
                emailLabel: 'Email',
                emailPlaceholder: 'Enter your email',
                passwordLabel: 'Password',
                passwordPlaceholder: 'Enter your password',
                forgotPassword: 'Forgot password?',
                loginButton: 'Sign In',
                noAccount: "Don't have an account? <a href='register.html'>Sign up</a>",
                
                // Register Page
                registerTitle: 'LCKY HUB - Register',
                registerHeading: 'Create Account',
                registerSubtitle: 'Join LCKY HUB',
                usernameLabel: 'Username',
                usernamePlaceholder: 'Enter your username',
                confirmPasswordLabel: 'Confirm Password',
                confirmPasswordPlaceholder: 'Repeat your password',
                acceptTerms: 'I accept the <a href="#" onclick="showTerms(); return false;">Terms</a> and <a href="#" onclick="showPrivacy(); return false;">Privacy Policy</a>',
                registerButton: 'Sign Up',
                hasAccount: 'Already have an account? <a href="login.html">Sign in</a>',
                welcomeTitle: 'Welcome to LCKY HUB',
                welcomeMessage: 'Your platform for reflex training and gaming community.',
                welcomeMotivational: 'Improve your reflexes, challenge friends, and reach new heights!',

                // Common
                loading: 'Loading...',
                error: 'Error',
                cancel: 'Cancel',
                confirm: 'Confirm',
                save: 'Save',
                close: 'Close',
                back: 'Back',
                next: 'Next',
                submit: 'Submit',

                // Errors
                loginError: 'Login failed. Please check your credentials.',
                registerError: 'Registration failed.',
                invalidEmail: 'Invalid email address',
                passwordMismatch: 'Passwords do not match',
                passwordTooShort: 'Password must be at least 6 characters',
                invalidCredentials: 'Invalid credentials',
                emailRequired: 'Email is required',
                usernameRequired: 'Username is required',
                termsRequired: 'Please accept the Terms and Privacy Policy',
                loginErrorEmpty: 'Please fill in all fields.',
                loginErrorPassword: 'Incorrect password.',
                loginErrorNotFound: 'User not found. Please register.',
                loginErrorWrongPassword: 'Wrong password. Please try again.',
                loginErrorInvalidEmail: 'Invalid email address.',
                loginErrorDisabled: 'This account has been disabled.',
                loginErrorTooMany: 'Too many attempts. Please wait.',
                loginErrorNetwork: 'Network error. Please check your connection.',
                registerErrorEmpty: 'Please fill in all fields.',
                registerErrorPassword: 'Password must be at least 6 characters.',
                registerErrorUsername: 'Username must be at least 3 characters.',
                registerErrorEmailExists: 'This email is already in use.',
                registerErrorWeakPassword: 'Password is too weak.',
                registerErrorPasswordMatch: 'Passwords do not match.',
                registerErrorTerms: 'Please accept the Terms and Privacy Policy.',
                errorGeneric: 'An error occurred. Please try again.',
                errorPopupClosed: 'Operation cancelled.',
                errorPopupRequest: 'Operation cancelled.',
                errorCredentialInUse: 'These credentials are already in use.',
                errorRecentLogin: 'Please sign in again.',
                errorNotLoggedIn: 'Please sign in first.',
                initError: 'Initialization error.',
                successLogin: 'Login successful!',
                successRegister: 'Account created successfully!',
                successPasswordReset: 'Password reset email sent',
                termsLabel: 'I accept the <a href="agb.html">Terms</a> and <a href="#">Privacy Policy</a>',
                
                // AGB / Privacy
                agbTitle: 'Terms of Service',
                privacyTitle: 'Privacy Policy',
                agbContent: `
                    <h2>1. General</h2>
                    <p>Welcome to LCKY HUB. By using our platform, you agree to these Terms of Service.</p>
                    
                    <h2>2. Usage</h2>
                    <p>You agree to use the platform for legal purposes only.</p>
                    
                    <h2>3. User Account</h2>
                    <p>You are responsible for the security of your account.</p>
                    
                    <h2>4. Liability</h2>
                    <p>Use is at your own risk.</p>
                `,
                privacyContent: `
                    <h2>1. Privacy</h2>
                    <p>We respect your privacy and protect your personal data.</p>
                    
                    <h2>2. Data Collection</h2>
                    <p>We only collect data necessary for platform operation.</p>
                    
                    <h2>3. Data Usage</h2>
                    <p>Your data is used only for platform operation.</p>
                    
                    <h2>4. Contact</h2>
                    <p>Contact us at lucassteckel04@gmail.com</p>
                `
            },
            fr: {
                loginTitle: 'LCKY HUB - Connexion',
                logoAlt: 'Logo LCKY HUB',
                loginHeading: 'Bon retour',
                loginSubtitle: 'Connectez-vous pour continuer',
                emailLabel: 'E-mail',
                emailPlaceholder: 'Entrez votre e-mail',
                passwordLabel: 'Mot de passe',
                passwordPlaceholder: 'Entrez votre mot de passe',
                forgotPassword: 'Mot de passe oublié?',
                loginButton: 'Se connecter',
                noAccount: 'Pas de compte? <a href="register.html">S\'inscrire</a>',
                registerTitle: 'LCKY HUB - Inscription',
                registerHeading: 'Créer un compte',
                registerSubtitle: 'Rejoignez LCKY HUB',
                usernameLabel: 'Nom d\'utilisateur',
                usernamePlaceholder: 'Entrez votre nom d\'utilisateur',
                confirmPasswordLabel: 'Confirmer le mot de passe',
                confirmPasswordPlaceholder: 'Répétez votre mot de passe',
                acceptTerms: 'J\'accepte les <a href="#" onclick="showTerms(); return false;">CGU</a> et <a href="#" onclick="showPrivacy(); return false;">la protection des données</a>',
                registerButton: 'S\'inscrire',
                hasAccount: 'Déjà inscrit? <a href="login.html">Se connecter</a>',
                welcomeTitle: 'Bienvenue sur LCKY HUB',
                welcomeMessage: 'Votre plateforme d\'entraînement aux réflexes et de communauté gaming.',
                welcomeMotivational: 'Améliorez vos réflexes, défiez vos amis et atteignez de nouveaux sommets!',
                loading: 'Chargement...',
                error: 'Erreur',
                cancel: 'Annuler',
                confirm: 'Confirmer',
                save: 'Enregistrer',
                close: 'Fermer',
                back: 'Retour',
                next: 'Suivant',
                submit: 'Soumettre',
                loginError: 'Échec de la connexion. Vérifiez vos identifiants.',
                registerError: 'Échec de l\'inscription.',
                invalidEmail: 'Adresse e-mail invalide',
                passwordMismatch: 'Les mots de passe ne correspondent pas',
                passwordTooShort: 'Le mot de passe doit contenir au moins 6 caractères',
                invalidCredentials: 'Identifiants invalides',
                emailRequired: 'L\'e-mail est requis',
                usernameRequired: 'Le nom d\'utilisateur est requis',
                termsRequired: 'Veuillez accepter les CGU et la protection des données',
                agbTitle: 'Conditions Générales d\'Utilisation',
                privacyTitle: 'Politique de Confidentialité'
            },
            es: {
                loginTitle: 'LCKY HUB - Iniciar Sesión',
                logoAlt: 'Logo LCKY HUB',
                loginHeading: 'Bienvenido de nuevo',
                loginSubtitle: 'Inicia sesión para continuar',
                emailLabel: 'Correo electrónico',
                emailPlaceholder: 'Introduce tu correo',
                passwordLabel: 'Contraseña',
                passwordPlaceholder: 'Introduce tu contraseña',
                forgotPassword: '¿Olvidaste tu contraseña?',
                loginButton: 'Iniciar Sesión',
                noAccount: '¿No tienes cuenta? <a href="register.html">Regístrate</a>',
                registerTitle: 'LCKY HUB - Registrarse',
                registerHeading: 'Crear cuenta',
                registerSubtitle: 'Únete a LCKY HUB',
                usernameLabel: 'Nombre de usuario',
                usernamePlaceholder: 'Introduce tu nombre de usuario',
                confirmPasswordLabel: 'Confirmar contraseña',
                confirmPasswordPlaceholder: 'Repite tu contraseña',
                acceptTerms: 'Acepto los <a href="#" onclick="showTerms(); return false;">Términos</a> y <a href="#" onclick="showPrivacy(); return false;">Política de Privacidad</a>',
                registerButton: 'Registrarse',
                hasAccount: '¿Ya tienes cuenta? <a href="login.html">Iniciar Sesión</a>',
                welcomeTitle: 'Bienvenido a LCKY HUB',
                welcomeMessage: 'Tu plataforma de entrenamiento de reflejos y comunidad gaming.',
                welcomeMotivational: '¡Mejora tus reflejos, desafía a tus amigos y alcanza nuevas alturas!',
                loading: 'Cargando...',
                error: 'Error',
                cancel: 'Cancelar',
                confirm: 'Confirmar',
                save: 'Guardar',
                close: 'Cerrar',
                back: 'Volver',
                next: 'Siguiente',
                submit: 'Enviar',
                loginError: 'Error al iniciar sesión. Verifica tus credenciales.',
                registerError: 'Error al registrarse.',
                invalidEmail: 'Correo electrónico inválido',
                passwordMismatch: 'Las contraseñas no coinciden',
                passwordTooShort: 'La contraseña debe tener al menos 6 caracteres',
                invalidCredentials: 'Credenciales inválidas',
                emailRequired: 'El correo es requerido',
                usernameRequired: 'El nombre de usuario es requerido',
                termsRequired: 'Por favor acepta los Términos y la Política de Privacidad',
                agbTitle: 'Términos de Servicio',
                privacyTitle: 'Política de Privacidad'
            }
        };

        this.currentLang = 'de';
    }

    // Initialize - detect system language
    init() {
        const savedLang = localStorage.getItem('lcky_language');
        if (savedLang && this.translations[savedLang]) {
            this.currentLang = savedLang;
        } else {
            // Detect system language
            const browserLang = navigator.language.split('-')[0];
            if (this.translations[browserLang]) {
                this.currentLang = browserLang;
            }
        }
        this.translatePage();
    }

    // Set language
    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('lcky_language', lang);
            this.translatePage();
        }
    }

    // Get current language
    getLanguage() {
        return this.currentLang;
    }

    // Translate a single key
    t(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];
        
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                // Fallback to English
                value = this.translations.en;
                for (const k2 of keys) {
                    if (value && value[k2]) {
                        value = value[k2];
                    } else {
                        return key; // Return key if not found
                    }
                }
                break;
            }
        }
        
        return value || key;
    }

    // Translate all elements with data-i18n attribute
    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.setAttribute('placeholder', this.t(key));
        });

        // Translate title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.setAttribute('title', this.t(key));
        });

        // Translate alt attributes
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            const key = el.getAttribute('data-i18n-alt');
            el.setAttribute('alt', this.t(key));
        });

        // Translate HTML content (for links with HTML)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            el.innerHTML = this.t(key);
        });

        // Update document title
        const titleKey = document.querySelector('[data-i18n]')?.getAttribute('data-i18n') || 'loginTitle';
        document.title = this.t(titleKey);
    }
}

// Global functions for AGB/Privacy modals
let i18nInstance;

document.addEventListener('DOMContentLoaded', () => {
    i18nInstance = new I18n();
    i18nInstance.init();
});

function showTerms() {
    if (i18nInstance) {
        const content = i18nInstance.t('agbContent');
        const title = i18nInstance.t('agbTitle');
        showModal(title, content);
    }
}

function showPrivacy() {
    if (i18nInstance) {
        const content = i18nInstance.t('privacyContent');
        const title = i18nInstance.t('privacyTitle');
        showModal(title, content);
    }
}

function showModal(title, content) {
    // Create modal if it doesn't exist
    let modal = document.getById('content-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'content-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title" id="modal-title"></h2>
                    <button class="modal-close" onclick="closeModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body" id="modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add modal styles
        const style = document.createElement('style');
        style.textContent = `
            .modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(13, 11, 20, 0.9);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 20px;
            }
            .modal-overlay.show {
                display: flex;
            }
            .modal {
                background: #15121F;
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 20px;
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .modal-title {
                font-size: 20px;
                font-weight: 600;
                color: white;
                margin: 0;
            }
            .modal-close {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: transparent;
                border: 1px solid rgba(139, 92, 246, 0.3);
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            .modal-close:hover {
                background: rgba(139, 92, 246, 0.2);
                border-color: #8B5CF6;
                color: white;
            }
            .modal-body {
                padding: 24px;
                overflow-y: auto;
                color: rgba(255, 255, 255, 0.8);
                font-size: 14px;
                line-height: 1.7;
            }
            .modal-body h2 {
                color: #A78BFA;
                font-size: 16px;
                margin: 24px 0 12px 0;
            }
            .modal-body h2:first-child {
                margin-top: 0;
            }
            .modal-body p {
                margin: 0 0 12px 0;
            }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    modal.classList.add('show');

    // ESC key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Click outside to close
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('content-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}
