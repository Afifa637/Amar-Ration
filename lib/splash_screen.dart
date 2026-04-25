import 'package:flutter/material.dart';
import 'login_screen.dart';
import 'home_screen.dart';
import 'services/api_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _loadAndRedirect();
  }

  Future<void> _loadAndRedirect() async {
    final startTime = DateTime.now();

    bool isLoggedIn = false;
    try {
      await ApiService.getMe();
      isLoggedIn = true;
    } catch (_) {
      await ApiService.clearSession();
      isLoggedIn = false;
    }

    // Ensure minimum 1.5s splash time
    final elapsed = DateTime.now().difference(startTime);
    if (elapsed < const Duration(milliseconds: 1500)) {
      await Future.delayed(const Duration(milliseconds: 1500) - elapsed);
    }

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => isLoggedIn ? const HomeScreen() : const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF1f77b4), Color(0xFF0d4f80)],
          ),
        ),
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.grain, size: 80, color: Colors.white),
              SizedBox(height: 20),
              Text(
                'আমার রেশন',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: 8),
              Text(
                'ফিল্ড ডিস্ট্রিবিউটর',
                style: TextStyle(
                  fontFamily: 'Anek Bangla',
                  fontSize: 16,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}