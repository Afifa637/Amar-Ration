import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_service.dart';
import 'signup_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    // Clear previous error
    setState(() {
      _errorMessage = null;
    });

    // Validate inputs
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      setState(() {
        _errorMessage = 'সকল ফিল্ড পূরণ করুন';
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Call real backend API
      final identifier = _emailController.text.trim();
      final password = _passwordController.text;

      final result = await ApiService.login(
        identifier: identifier,
        password: password,
      );

      final token = result['data']?['token'] as String?;
      final user = result['data']?['user'] as Map<String, dynamic>?;

      if (token == null || user == null) {
        throw Exception('Invalid server response');
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('amar_ration_auth', token);
      await prefs.setString('user_name', user['name'] ?? '');
      if (user['email'] != null) await prefs.setString('user_email', user['email']);
      if (user['phone'] != null) await prefs.setString('user_phone', user['phone']);
      await prefs.setString('login_time', DateTime.now().toString());

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const HomeScreen()),
        );
      }
    } catch (e) {
      setState(() {
        if (e is ApiException) {
          _errorMessage = e.message;
        } else {
          _errorMessage = 'লগইন ব্যর্থ। পুনরায় চেষ্টা করুন।';
        }
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'লগইন করুন',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              // Header Section
              Center(
                child: Column(
                  children: const [
                    Text(
                      'আমার রেশন',
                      style: TextStyle(
                        fontFamily: 'Anek Bangla',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1f77b4),
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'ডিস্ট্রিবিউটর লগইন',
                      style: TextStyle(
                        fontFamily: 'Anek Bangla',
                        fontSize: 14,
                        color: Color(0xFF666666),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'ফিল্ড ডিস্ট্রিবিউটরদের জন্য',
                      style: TextStyle(
                        fontFamily: 'Roboto',
                        fontSize: 12,
                        color: Color(0xFF999999),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),

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

              // Email/Phone Field
              const Text(
                'ইমেইল অথবা ফোন *',
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
                keyboardType: TextInputType.emailAddress,
                enabled: !_isLoading,
                decoration: InputDecoration(
                  hintText: 'আপনার ইমেইল বা ফোন লিখুন',
                  hintStyle: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    color: Color(0xFFAAAAAA),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
              const SizedBox(height: 20),

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
              const SizedBox(height: 4),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                enabled: !_isLoading,
                decoration: InputDecoration(
                  hintText: 'আপনার পাসওয়ার্ড লিখুন',
                  hintStyle: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    color: Color(0xFFAAAAAA),
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _isLoading ? null : () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('পাসওয়ার্ড রিসেট বৈশিষ্ট্য শীঘ্রই আসছে')),
                    );
                  },
                  child: const Text(
                    'পাসওয়ার্ড ভুলে গেছেন?',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF1f77b4),
                      fontFamily: 'Anek Bangla',
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Login Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
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
                    'লগইন করুন',
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

              // Sign Up Link
              Center(
                child: Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    const Text(
                      'নতুন অ্যাকাউন্ট নেই? ',
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
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const SignUpScreen(),
                          ),
                        );
                      },
                      child: const Text(
                        'এখানে সাইন আপ করুন',
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
            ],
          ),
        ),
      ),
    );
  }
}