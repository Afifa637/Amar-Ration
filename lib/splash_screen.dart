import 'package:amar_ration_app/signup_screen.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('amar_ration_auth');

    // Simulate a delay for the splash screen
    await Future.delayed(const Duration(seconds: 2));

    if (token != null) {
      // Navigate to HomeScreen if token exists
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const SignUpScreen()),
      );
    } else {
      // Navigate to LoginScreen if no token
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/images/bg-2',
              fit: BoxFit.cover,
            ),
            Image.asset(
              'assets/images/app_logo.png', // Replace with your app logo path
              width: 100,
              height: 100,
            ),
            const SizedBox(height: 16),
            const Text(
              'আমার রেশন',
              style: TextStyle(
                fontFamily: 'BanglaFont',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1f77b4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}