export type PublicEnv = {
  appName: string;
};

export function loadPublicEnv(input: NodeJS.ProcessEnv): PublicEnv {
  const appName = input.NEXT_PUBLIC_APP_NAME?.trim();

  return {
    appName: appName || "Hypothesis Portal",
  };
}

