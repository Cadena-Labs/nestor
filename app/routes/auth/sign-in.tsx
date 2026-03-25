import { SignIn } from "@clerk/react-router";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {/*
        Explicit path/routing: @clerk/react-router’s default path comes from usePathnameWithoutSplatRouteParams,
        which freezes the first pathname in a ref — wrong path after redirects breaks embedded SignIn (blank UI).
      */}
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </div>
  );
}
