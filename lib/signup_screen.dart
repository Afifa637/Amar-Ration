import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import 'home_screen.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({Key? key}) : super(key: key);

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _passwordController;
  late TextEditingController _confirmPasswordController;
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _emailController = TextEditingController();
    _phoneController = TextEditingController();
    _passwordController = TextEditingController();
    _confirmPasswordController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _validateInputs() {
    if (_nameController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _phoneController.text.isEmpty ||
        _passwordController.text.isEmpty ||
        _confirmPasswordController.text.isEmpty) {
      setState(() {
        _errorMessage = 'সকল ফিল্ড পূরণ করুন';
      });
      return false;
    }

    if (_nameController.text.length < 3) {
      setState(() {
        _errorMessage = 'নাম কমপক্ষে ৩ অক্ষর হতে হবে';
      });
      return false;
    }

    if (!_emailController.text.contains('@')) {
      setState(() {
        _errorMessage = 'বৈধ ইমেইল প্রবেশ করুন';
      });
      return false;
    }

    if (_phoneController.text.length != 11) {
      setState(() {
        _errorMessage = 'বৈধ বাংলাদেশ ফোন নম্বর প্রবেশ করুন';
      });
      return false;
    }

    if (_passwordController.text.length < 8) {
      setState(() {
        _errorMessage = 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে';
      });
      return false;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() {
        _errorMessage = 'পাসওয়ার্ড ম্যাচ করে না';
      });
      return false;
    }

    return true;
  }

  Future<void> _handleSignUp() async {
    setState(() {
      _errorMessage = null;
    });

    if (!_validateInputs()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // TODO: Integrate with actual backend API
      // For now, simulate successful signup
      await Future.delayed(const Duration(seconds: 1));

      // Store user data in SharedPreferences (mock)
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('amar_ration_auth', 'mock_jwt_token_${DateTime.now().millisecondsSinceEpoch}');
      await prefs.setString('user_name', _nameController.text);
      await prefs.setString('user_email', _emailController.text);
      await prefs.setString('user_phone', _phoneController.text);
      await prefs.setString('login_time', DateTime.now().toString());

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!'),
            duration: Duration(seconds: 2),
          ),
        );

        Future.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const HomeScreen()),
            );
          }
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'সাইন আপ ব্যর্থ। পুনরায় চেষ্টা করুন।';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  String _getPasswordStrength(String password) {
    if (password.isEmpty) return '';
    if (password.length < 8) return 'দুর্বল';
    if (password.length < 12) return 'মাঝারি';
    return 'শক্তিশালী';
  }

  Color _getPasswordStrengthColor(String password) {
    if (password.isEmpty) return Colors.transparent;
    if (password.length < 8) return const Color(0xFFdc3545);
    if (password.length < 12) return const Color(0xFFFFC107);
    return const Color(0xFF28a745);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            Navigator.pop(context);
          },
        ),
        title: const Text(
          'নতুন অ্যাকাউন্ট তৈরি করুন',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),

            // Error Message Display
            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F0F0),
                  border: Border.all(color: const Color(0xFFdc3545)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error, color: Color(0xFFdc3545), size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 13,
                          color: Color(0xFFdc3545),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Full Name Field
            const Text(
              'সম্পূর্ণ নাম *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _nameController,
              enabled: !_isLoading,
              decoration: InputDecoration(
                hintText: 'আপনার সম্পূর্ণ নাম',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2.0),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Email Field
            const Text(
              'ইমেইল *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _emailController,
              enabled: !_isLoading,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                hintText: 'ইমেইল@উদাহরণ.com',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2.0),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Phone Field
            const Text(
              'ফোন নম্বর *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _phoneController,
              enabled: !_isLoading,
              keyboardType: TextInputType.phone,
              maxLength: 11,
              decoration: InputDecoration(
                hintText: '01XXXXXXXXX',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2.0),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Password Field
            const Text(
              'পাসওয়ার্ড *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const Text(
              'কমপক্ষে ৮ অক্ষর',
              style: TextStyle(
                fontSize: 11,
                color: Color(0xFF999999),
                fontFamily: 'Anek Bangla',
                fontStyle: FontStyle.italic,
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _passwordController,
              enabled: !_isLoading,
              obscureText: _obscurePassword,
              onChanged: (value) {
                setState(() {});
              },
              decoration: InputDecoration(
                hintText: 'শক্তিশালী পাসওয়ার্ড',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2.0),
                ),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePassword ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFF1f77b4),
                  ),
                  onPressed: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Password Strength Indicator
            if (_passwordController.text.isNotEmpty)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (_passwordController.text.length / 16).clamp(0, 1),
                      minHeight: 4,
                      backgroundColor: const Color(0xFFEFEFEF),
                      valueColor: AlwaysStoppedAnimation(
                        _getPasswordStrengthColor(_passwordController.text),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _getPasswordStrength(_passwordController.text),
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 11,
                      color: _getPasswordStrengthColor(_passwordController.text),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 16),

            // Confirm Password Field
            const Text(
              'পাসওয়ার্ড নিশ্চিত করুন *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _confirmPasswordController,
              enabled: !_isLoading,
              obscureText: _obscureConfirmPassword,
              decoration: InputDecoration(
                hintText: 'পাসওয়ার্ড পুনরায় লিখুন',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6.0),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2.0),
                ),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFF1f77b4),
                  ),
                  onPressed: () {
                    setState(() {
                      _obscureConfirmPassword = !_obscureConfirmPassword;
                    });
                  },
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Sign Up Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _handleSignUp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1f77b4),
                  disabledBackgroundColor: const Color(0xFFCCCCCC),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                  ),
                  elevation: 2,
                ),
                child: _isLoading
                    ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                )
                    : const Text(
                  'সাইন আপ করুন',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    fontFamily: 'Anek Bangla',
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Login Link
            Center(
              child: Wrap(
                alignment: WrapAlignment.center,
                children: [
                  const Text(
                    'ইতিমধ্যে অ্যাকাউন্ট আছে? ',
                    style: TextStyle(
                      fontSize: 13,
                      color: Color(0xFF666666),
                      fontFamily: 'Anek Bangla',
                    ),
                  ),
                  GestureDetector(
                    onTap: _isLoading
                        ? null
                        : () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const LoginScreen(),
                        ),
                      );
                    },
                    child: const Text(
                      'এখানে লগইন করুন',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF1f77b4),
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Anek Bangla',
                        decoration: TextDecoration.underline,
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
}