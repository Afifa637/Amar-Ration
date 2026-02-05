import { useNavigate } from "react-router-dom";

const EntrancePage = () => {
  const navigate = useNavigate();

  const loginOptions = [
    {
      title: "কেন্দ্রীয় অ্যাডমিন",
      role: "central-admin",
      icon: "admin_panel_settings",
    },
    {
      title: "ডিস্ট্রিবিউটর",
      role: "distributor",
      icon: "inventory_2",
    },
    {
      title: "ফিল্ড ডিস্ট্রিবিউটর",
      role: "field-distributor",
      icon: "local_shipping",
    },
  ];

  const handleLoginSelect = (role: string) => {
    navigate(`/login/${role}`);
  };

  return (
    <div
      className="min-h-screen flex flex-col pt-8 px-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/image/bg-2.jpg')",
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex-grow flex flex-col">
        {/* Logo at the top */}
        <div className="flex justify-center">
          <img
            src="/assets/image/app_logo.png"
            alt="আমার রেশন"
            style={{ width: '200px', height: '200px' }}
            className="object-contain drop-shadow-2xl"
          />
        </div>

        {/* App Name */}
        <div className="text-center mb-8">
          <h1 className="font-bold text-white drop-shadow-lg mb-2" style={{ fontSize: '62px' }}>
            আমার রেশন
          </h1>
        </div>

        {/* Login Cards */}
        <div className="flex justify-center items-center mx-auto mb-auto" style={{ gap: '48px' }}>
          {loginOptions.map((option) => (
            <button
              key={option.role}
              onClick={() => handleLoginSelect(option.role)}
              style={{ width: '280px', height: '280px', padding: '32px' }}
              className="bg-white/10 backdrop-blur-lg text-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.4)] hover:shadow-[0_15px_50px_rgba(0,0,0,0.5)] border border-white/20 transform hover:scale-105 hover:-translate-y-2 transition-all duration-300 flex items-center justify-center"
            >
              <div className="flex flex-col items-center justify-between text-center" style={{ height: '100%', width: '100%' }}>
                {/* Icon */}
                <div className="transition-transform duration-300 hover:scale-110" style={{ marginTop: '12px' }}>
                  <span className="material-icons text-white drop-shadow-lg" style={{ fontSize: '64px' }}>
                    {option.icon}
                  </span>
                </div>

                {/* Title */}
                <div className="flex-grow flex flex-col justify-center">
                  <h2 className="text-white font-bold" style={{ fontSize: '26px', marginBottom: '10px' }}>
                    {option.title}
                  </h2>
                   </div>

                {/* Login Button */}
                <div style={{ width: '100%', marginBottom: '12px' }}>
                  <div className="bg-white/90 backdrop-blur-sm text-[#16679c] rounded-lg hover:bg-white transition-colors duration-300 text-center font-semibold shadow-md" style={{ padding: '10px 28px', fontSize: '17px' }}>
                    লগইন করুন
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="relative z-10 text-center pb-4">
        <p className="text-white/80 text-sm drop-shadow">
          © 2026 আমার রেশন | সর্বস্বত্ব সংরক্ষিত
        </p>
      </div>
    </div>
  );
};

export default EntrancePage;
