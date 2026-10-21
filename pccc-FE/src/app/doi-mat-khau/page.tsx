import { currentUser } from "@/lib/backend";
import { ChangePasswordForm } from "./password-form";

export const metadata = { title: "Đổi mật khẩu" };
export default async function ChangePasswordPage() {
  const user = await currentUser();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-bold">Đổi mật khẩu</h1>
      <p className="text-sm">
        {user.fullName}
        {user.mustChangePassword
          ? ", bạn có thể đổi mật khẩu hoặc chọn Bỏ qua, đổi sau để tiếp tục."
          : ", nhập mật khẩu hiện tại và mật khẩu mới."}
      </p>
      <ChangePasswordForm />
    </main>
  );
}
