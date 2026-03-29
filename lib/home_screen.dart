import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import 'qr_scanner_screen.dart';
import 'scan_history_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String distributorName = 'ব্যবহারকারী';
  int todayScans = 0;
  int eligibleCount = 0;
  int ineligibleCount = 0;
  List<Map<String, dynamic>> recentScans = [];
  int _currentBottomNavIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      distributorName = prefs.getString('user_name') ?? 'ব্যবহারকারী';
      todayScans = prefs.getInt('today_scans') ?? 0;
      eligibleCount = prefs.getInt('eligible_count') ?? 0;
      ineligibleCount = prefs.getInt('ineligible_count') ?? 0;
    });
    // In a real app, fetch recent scans from backend or local storage
    _loadRecentScans();
  }

  Future<void> _loadRecentScans() async {
    // Mock data for recent scans
    setState(() {
      recentScans = [
        {
          'consumerName': 'রহিম আহমেদ',
          'status': 'সফল',
          'timestamp': '১০:৩০ এএম',
        },
        {
          'consumerName': 'ফাতিমা বেগম',
          'status': 'সফল',
          'timestamp': '১০:১৫ এএম',
        },
        {
          'consumerName': 'করিম হাসান',
          'status': 'অযোগ্য',
          'timestamp': '০৯:৪৫ এএম',
        },
        {
          'consumerName': 'সালমা খাতুন',
          'status': 'সফল',
          'timestamp': '০৯:৩০ এএম',
        },
        {
          'consumerName': 'আবুল কাশেম',
          'status': 'সফল',
          'timestamp': '০৯:১৫ এএম',
        },
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'আমার রেশন',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Color(0xFF1f77b4),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'স্বাগতম, $distributorName 👋',
                    style: const TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'আজ আপনার কার্যকলাপ',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 14,
                      color: Color(0xFFE8F0F8),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Main QR Scan Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                height: 140,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const QRScannerScreen(),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF28a745),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 4,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.qr_code_2,
                        size: 48,
                        color: Colors.white,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'QR স্কেন করুন',
                        style: TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Statistics Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'দ্রুত পরিসংখ্যান',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard(
                          title: 'আজকের স্কেন',
                          value: todayScans.toString(),
                          icon: Icons.qr_code,
                          color: const Color(0xFF1f77b4),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildStatCard(
                          title: 'যোগ্য',
                          value: eligibleCount.toString(),
                          icon: Icons.check_circle,
                          color: const Color(0xFF28a745),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildStatCard(
                          title: 'অযোগ্য',
                          value: ineligibleCount.toString(),
                          icon: Icons.cancel,
                          color: const Color(0xFFdc3545),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Recent Scans Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'সাম্প্রতিক স্কেনসমূহ',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 12),
                  recentScans.isEmpty
                      ? Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFEFEFEF)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Column(
                        children: const [
                          Icon(Icons.inbox, size: 40, color: Color(0xFFCCCCCC)),
                          SizedBox(height: 8),
                          Text(
                            'এখনও কোনো স্কেন নেই',
                            style: TextStyle(
                              fontFamily: 'Anek Bangla',
                              fontSize: 14,
                              color: Color(0xFF999999),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                      : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: recentScans.length,
                    itemBuilder: (context, index) {
                      final scan = recentScans[index];
                      final isSuccess =
                          scan['status'] == 'সফল';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: isSuccess
                                ? const Color(0xFFE8F5E9)
                                : const Color(0xFFFFEBEE),
                          ),
                          borderRadius: BorderRadius.circular(8),
                          color: isSuccess
                              ? const Color(0xFFF0F8F0)
                              : const Color(0xFFFFF0F0),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isSuccess
                                  ? Icons.check_circle
                                  : Icons.cancel,
                              color: isSuccess
                                  ? const Color(0xFF28a745)
                                  : const Color(0xFFdc3545),
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    scan['consumerName'],
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF333333),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    scan['timestamp'],
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 12,
                                      color: Color(0xFF999999),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              scan['status'],
                              style: TextStyle(
                                fontFamily: 'Anek Bangla',
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSuccess
                                    ? const Color(0xFF28a745)
                                    : const Color(0xFFdc3545),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF16679c),
        selectedItemColor: Colors.white,
        unselectedItemColor: const Color(0xFFB3D9FF),
        currentIndex: _currentBottomNavIndex,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'প্রধান',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.qr_code_2),
            label: 'স্কেনার',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'ইতিহাস',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'প্রোফাইল',
          ),
        ],
        onTap: (index) {
          setState(() {
            _currentBottomNavIndex = index;
          });

          if (index == 1) {
            // Navigate to QR Scanner
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const QRScannerScreen()),
            );
          } else if (index == 2) {
            // Navigate to Scan History
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ScanHistoryScreen()),
            );
          } else if (index == 3) {
            // Navigate to Profile Screen
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ProfileScreen()),
            );
          }
        },
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFEFEFEF)),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 11,
              color: Color(0xFF999999),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('amar_ration_auth');
    await prefs.remove('user_id');
    await prefs.remove('user_name');
    await prefs.remove('user_email');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String distributorName = '';
  String distributorEmail = '';
  String distributorPhone = '';
  String loginTime = '';

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  Future<void> _loadProfileData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      distributorName = prefs.getString('user_name') ?? 'নাম পাওয়া যায়নি';
      distributorEmail = prefs.getString('user_email') ?? 'ইমেইল পাওয়া যায়নি';
      distributorPhone = prefs.getString('user_phone') ?? 'ফোন পাওয়া যায়নি';
      loginTime = prefs.getString('login_time') ?? 'সময় পাওয়া যায়নি';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'আমার প্রোফাইল',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Profile Header Section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Color(0xFF1f77b4),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                ),
              ),
              child: Column(
                children: [
                  // Profile Image/Avatar
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFE8F0F8),
                      border: Border.all(
                        color: Colors.white,
                        width: 3,
                      ),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.person,
                        size: 40,
                        color: Color(0xFF1f77b4),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    distributorName,
                    style: const TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'ফিল্ড ডিস্ট্রিবিউটর',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 14,
                      color: const Color(0xFF1f77b4).withOpacity(0.8),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Profile Information Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ব্যক্তিগত তথ্য',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildProfileInfoItem(
                    icon: Icons.email,
                    label: 'ইমেইল',
                    value: distributorEmail,
                    color: const Color(0xFF1f77b4),
                  ),
                  const SizedBox(height: 16),
                  _buildProfileInfoItem(
                    icon: Icons.phone,
                    label: 'ফোন নম্বর',
                    value: distributorPhone,
                    color: const Color(0xFF1f77b4),
                  ),
                  const SizedBox(height: 16),
                  _buildProfileInfoItem(
                    icon: Icons.access_time,
                    label: 'লগইন সময়',
                    value: loginTime,
                    color: const Color(0xFF1f77b4),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Action Buttons Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'অ্যাকাউন্ট',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('পাসওয়ার্ড পরিবর্তন বৈশিষ্ট্য শীঘ্রই আসছে'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.lock),
                      label: const Text(
                        'পাসওয়ার্ড পরিবর্তন করুন',
                        style: TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFFC107),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('সেটিংস বৈশিষ্ট্য শীঘ্রই আসছে'),
                          ),
                        );
                      },
                      icon: const Icon(Icons.settings),
                      label: const Text(
                        'সেটিংস',
                        style: TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16679c),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _handleLogout,
                      icon: const Icon(Icons.logout),
                      label: const Text(
                        'লগআউট',
                        style: TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFdc3545),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileInfoItem({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFEFEFEF)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 12,
                    color: Color(0xFF999999),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF333333),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text(
            'লগআউট নিশ্চিত করুন',
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontWeight: FontWeight.bold,
            ),
          ),
          content: const Text(
            'আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?',
            style: TextStyle(fontFamily: 'Anek Bangla'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'বাতিল',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFF1f77b4),
                ),
              ),
            ),
            TextButton(
              onPressed: () async {
                final prefs = await SharedPreferences.getInstance();
                await prefs.remove('amar_ration_auth');
                await prefs.remove('user_id');
                await prefs.remove('user_name');
                await prefs.remove('user_email');
                await prefs.remove('user_phone');
                await prefs.remove('login_time');

                if (mounted) {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                  );
                }
              },
              child: const Text(
                'লগআউট করুন',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFdc3545),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
