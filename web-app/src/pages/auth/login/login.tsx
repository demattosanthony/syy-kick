import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "@/features/auth/hooks";
import googleLogo from "@/assets/logos/google.svg";
import microsoftLogo from "@/assets/logos/msft.svg";

export function LoginPage() {
  const navigate = useNavigate();
  const { handleGoogleLogin, handleMicrosoftLogin } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 h-screen">
      <div className="absolute top-1 left-1">
        <Button
          onClick={() => {
            navigate(-1);
          }}
          size={"icon"}
          variant={"ghost"}
        >
          <ArrowLeft size={24} />
        </Button>
      </div>

      <main className="flex flex-col gap-8 items-center w-full justify-center h-[75%]">
        {/** Title and description */}
        <div className="flex flex-col items-center w-[400px] gap-2">
          <div className="mb-4">
            <img src={"/logo512.png"} width={65} height={65} alt="" />
          </div>

          <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Let&apos;s get started!
          </h3>
        </div>

        {/** Oauth buttons */}
        <div className="flex flex-col gap-4">
          <Button
            className="font-semibold w-[320px] flex justify-start h-[50px]"
            onClick={handleGoogleLogin}
            variant={"outline"}
          >
            <img
              src={googleLogo}
              alt="google"
              width={20}
              height={20}
              className="mr-1"
            />
            Continue with Google
          </Button>
          <Button
            className="font-semibold w-[320px] flex justify-start h-[50px]"
            onClick={handleMicrosoftLogin}
            variant={"outline"}
          >
            <img
              src={microsoftLogo}
              alt="msft"
              width={20}
              height={20}
              className="mr-1"
            />
            Continue with Microsoft
          </Button>
        </div>
      </main>

      <div className="absolute bottom-4 flex flex-col items-center gap-2">
        <footer className="text-xs text-gray-500 text-center shrink-0">
          By using our service, you agree to our{" "}
          <a
            href="/policies/terms-of-use"
            className="underline hover:text-gray-700"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/policies/privacy-policy"
            className="underline hover:text-gray-700"
          >
            Privacy Policy
          </a>
        </footer>
      </div>
    </div>
  );
}
