declare module './hooks/useCognitoAuth' {
  export interface UseCognitoAuthResult {
    user: any;
    loading: boolean;
    error: any;
    signUp(email: string, password: string): Promise<any>;
    confirmSignUp(email: string, code: string): Promise<any>;
    resendConfirmationCode(email: string): Promise<any>;
    signIn(email: string, password: string): Promise<any>;
    signOut(): void;
    forgotPassword(email: string): Promise<any>;
    confirmForgotPassword(email: string, code: string, newPassword: string): Promise<any>;
    getUserId(): Promise<string>;
    getUserEmail(): Promise<string>;
    isAuthenticated(): Promise<boolean>;
  }

  export function useCognitoAuth(): UseCognitoAuthResult;
}


