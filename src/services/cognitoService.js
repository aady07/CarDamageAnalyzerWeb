import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

if (!USER_POOL_ID || !CLIENT_ID) {
  throw new Error(
    'Missing Cognito env vars. Please set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID at build time.'
  );
}

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
});

function getCognitoUserByEmail(email) {
  return new CognitoUser({ Username: email, Pool: userPool });
}

export const cognitoService = {
  signUp(email, password) {
    return new Promise((resolve, reject) => {
      const attributeList = [];
      // Store email as username attribute
      // Note: amazon-cognito-identity-js expects CognitoUserAttribute for user attributes,
      // but we can sign up without additional attributes if the pool allows it.
      userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) return reject(err);
        resolve(result?.user);
      });
    });
  },

  confirmSignUp(email, code) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUserByEmail(email);
      user.confirmRegistration(code, true, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  resendConfirmationCode(email) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUserByEmail(email);
      user.resendConfirmationCode((err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  signIn(email, password) {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });
      const user = getCognitoUserByEmail(email);

      user.authenticateUser(authDetails, {
        onSuccess: (session) => {
          // Do not log tokens
          resolve({
            accessToken: session.getAccessToken().getJwtToken(),
            idToken: session.getIdToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken(),
          });
        },
        onFailure: (err) => reject(err),
        newPasswordRequired: () => {
          reject(new Error('New password required. Please complete challenge in another flow.'));
        },
      });
    });
  },

  forgotPassword(email) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUserByEmail(email);
      user.forgotPassword({
        onSuccess: (data) => resolve(data),
        onFailure: (err) => reject(err),
      });
    });
  },

  confirmForgotPassword(email, code, newPassword) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUserByEmail(email);
      user.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(true),
        onFailure: (err) => reject(err),
      });
    });
  },

  signOut() {
    const user = userPool.getCurrentUser();
    if (user) user.signOut();
  },

  getCurrentUser() {
    return userPool.getCurrentUser();
  },

  getSession() {
    return new Promise((resolve) => {
      const user = userPool.getCurrentUser();
      if (!user) return resolve(null);
      user.getSession((err, session) => {
        if (err || !session || !session.isValid()) return resolve(null);
        resolve(session);
      });
    });
  },

  async getAccessToken() {
    const session = await this.getSession();
    if (!session) throw new Error('No active session');
    return session.getAccessToken().getJwtToken();
  },

  async getIdToken() {
    const session = await this.getSession();
    if (!session) throw new Error('No active session');
    return session.getIdToken().getJwtToken();
  },

  async getUserId() {
    const idToken = await this.getIdToken();
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload.sub;
  },

  async getUserEmail() {
    const idToken = await this.getIdToken();
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload.email;
  },

  async isAuthenticated() {
    const session = await this.getSession();
    return !!session;
  },
};


