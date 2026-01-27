import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Topbar() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (auth) {
      auth.logout();
      navigate("/login");
    }
  };

  return (
    <header className="bg-[#1f77b4] text-white">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-white/15 flex items-center justify-center text-sm font-bold">
            টিসি
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">টিসিবি স্মার্ট ফ্যামিলি কার্ড</div>
            <div className="text-[12px] opacity-90">মনিটরিং ড্যাশবোর্ড</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block text-[12px] opacity-90">
            ব্যবহারকারী: <span className="font-semibold">ডিলার/অপারেটর</span>
          </div>
          <button onClick={handleLogout} className="bg-white/15 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded">
            প্রোফাইল
          </button>
        </div>
      </div>

      {/* top links bar */}
      <div className="bg-[#16679c] px-4 py-2 text-[13px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a className="hover:underline" href="#">হোম</a>
          <a className="hover:underline" href="#">ড্যাশবোর্ড</a>
          <a className="hover:underline" href="#">রিপোর্ট</a>
          <a className="hover:underline" href="#">মনিটরিং</a>
          <a className="hover:underline" href="#">সেটিংস</a>
          <a className="hover:underline" href="#">সহায়তা</a>
        </div>
      </div>
    </header>
  );
}

