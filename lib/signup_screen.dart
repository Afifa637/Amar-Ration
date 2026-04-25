import 'package:flutter/material.dart';
import 'services/api_service.dart';
import 'login_screen.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({Key? key}) : super(key: key);

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

// Canonical Bangla division names — must match backend DIVISION_KEY_MAP
const List<String> _kDivisions = [
  'ঢাকা',
  'চট্টগ্রাম',
  'রাজশাহী',
  'খুলনা',
  'বরিশাল',
  'সিলেট',
  'রংপুর',
  'ময়মনসিংহ',
];

class _SignUpScreenState extends State<SignUpScreen> {
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _wardNoController;
  String? _selectedDivision; // replaces free-text division controller
  late TextEditingController _districtController;
  late TextEditingController _upazilaController;
  late TextEditingController _unionNameController;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController();
    _emailController = TextEditingController();
    _phoneController = TextEditingController();
    _wardNoController = TextEditingController();
    _selectedDivision = null;
    _districtController = TextEditingController();
    _upazilaController = TextEditingController();
    _unionNameController = TextEditingController();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _wardNoController.dispose();
    _districtController.dispose();
    _upazilaController.dispose();
    _unionNameController.dispose();
    super.dispose();
  }

  bool _validateInputs() {
    if (_nameController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _phoneController.text.isEmpty) {
      setState(() {
        _errorMessage = 'নাম, ইমেইল এবং ফোন নম্বর আবশ্যক';
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

    // Validate ward number is a numeric value
    final wardText = _wardNoController.text.trim();
    final wardDigits = wardText.replaceAll(RegExp(r'[০১২৩৪৫৬৭৮৯]'), (m) {
      const map = {'০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
      return map[m] ?? m;
    }).replaceAll(RegExp(r'\D'), '');
    if (wardDigits.isEmpty) {
      setState(() {
        _errorMessage = 'বৈধ ওয়ার্ড নম্বর প্রবেশ করুন (যেমন: ০২ বা 02)';
      });
      return false;
    }

    if (_selectedDivision == null ||
        _districtController.text.isEmpty ||
        _upazilaController.text.isEmpty ||
        _unionNameController.text.isEmpty) {
      setState(() {
        _errorMessage = 'সকল বিভাগীয় তথ্য পূরণ করুন';
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
      final result = await ApiService.applyAsFieldDistributor(
        name: _nameController.text.trim(),
        email: _emailController.text.trim().toLowerCase(),
        phone: _phoneController.text.trim(),
        wardNo: _wardNoController.text.trim(),
        division: _selectedDivision!,
        district: _districtController.text.trim(),
        upazila: _upazilaController.text.trim(),
        unionName: _unionNameController.text.trim(),
      );

      if (mounted) {
        _showSuccessDialog();
      }
    } catch (e) {
      setState(() {
        if (e is ApiException) {
          _errorMessage = e.message;
        } else {
          _errorMessage = 'আবেদন জমা ব্যর্থ। পুনরায় চেষ্টা করুন।';
        }
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Color(0xFF28a745), size: 64),
            const SizedBox(height: 16),
            const Text(
              'আবেদন সফলভাবে জমা হয়েছে!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Anek Bangla',
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'আপনার আবেদন ডিস্ট্রিবিউটরের কাছে পাঠানো হয়েছে। অনুমোদনের পর আপনার ইমেইলে ইউজারনেম ও পাসওয়ার্ড পাঠানো হবে।',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Anek Bangla',
                fontSize: 13,
                color: Color(0xFF666666),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (context) => const LoginScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1f77b4),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Text(
                  'ঠিক আছে',
                  style: TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
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

            // Address Fields for FieldUser
            const Text(
              'ওয়ার্ড নম্বর *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _wardNoController,
              enabled: !_isLoading,
              keyboardType: TextInputType.number,
              maxLength: 2,
              decoration: InputDecoration(
                hintText: '০১',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                helperText: 'শুধু ওয়ার্ড নম্বর লিখুন (যেমন: ০২ বা 02)',
                helperStyle: const TextStyle(fontFamily: 'Anek Bangla', fontSize: 11),
                counterText: '',
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
            const SizedBox(height: 12),

            const Text(
              'বিভাগ *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              value: _selectedDivision,
              isExpanded: true,
              decoration: InputDecoration(
                hintText: 'বিভাগ নির্বাচন করুন',
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
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
              ),
              items: _kDivisions
                  .map((div) => DropdownMenuItem<String>(
                        value: div,
                        child: Text(
                          div,
                          style: const TextStyle(fontFamily: 'Anek Bangla', fontSize: 14),
                        ),
                      ))
                  .toList(),
              onChanged: _isLoading
                  ? null
                  : (value) => setState(() => _selectedDivision = value),
            ),
            const SizedBox(height: 12),

            const Text(
              'জেলা *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _districtController,
              enabled: !_isLoading,
              decoration: InputDecoration(
                hintText: 'ঢাকা',
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
            const SizedBox(height: 12),

            const Text(
              'উপজেলা *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _upazilaController,
              enabled: !_isLoading,
              decoration: InputDecoration(
                hintText: 'সাভার',
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
            const SizedBox(height: 12),

            const Text(
              'ইউনিয়ন নাম *',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFF333333),
                fontFamily: 'Anek Bangla',
              ),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _unionNameController,
              enabled: !_isLoading,
              decoration: InputDecoration(
                hintText: 'তেঁতুলঝোড়া',
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
            const SizedBox(height: 12),

            const SizedBox(height: 16),

            // Info box about approval process
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E1),
                border: Border.all(color: const Color(0xFFFFC107)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Color(0xFFFFC107), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'আবেদন জমা দেওয়ার পর আপনার বিভাগের ডিস্ট্রিবিউটর অনুমোদন করলে আপনার ইমেইলে ইউজারনেম ও পাসওয়ার্ড পাঠানো হবে।',
                      style: TextStyle(
                        fontFamily: 'Anek Bangla',
                        fontSize: 12,
                        color: Color(0xFF333333),
                      ),
                    ),
                  ),
                ],
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
                  'আবেদন জমা দিন',
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