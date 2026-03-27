import 'package:flutter/material.dart';

class SignUpScreen extends StatelessWidget {
  const SignUpScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'নতুন অ্যাকাউন্ট তৈরি করুন',
          style: TextStyle(fontFamily: 'BanglaFont'),
        ),
        backgroundColor: const Color(0xFF1f77b4),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'নাম',
              style: TextStyle(fontSize: 16, fontFamily: 'BanglaFont'),
            ),
            const SizedBox(height: 8),
            TextField(
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                hintText: 'আপনার নাম লিখুন',
                hintStyle: const TextStyle(fontFamily: 'BanglaFont'),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'ইমেইল',
              style: TextStyle(fontSize: 16, fontFamily: 'BanglaFont'),
            ),
            const SizedBox(height: 8),
            TextField(
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                hintText: 'আপনার ইমেইল লিখুন',
                hintStyle: const TextStyle(fontFamily: 'BanglaFont'),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'ফোন',
              style: TextStyle(fontSize: 16, fontFamily: 'BanglaFont'),
            ),
            const SizedBox(height: 8),
            TextField(
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                hintText: 'আপনার ফোন নম্বর লিখুন',
                hintStyle: const TextStyle(fontFamily: 'BanglaFont'),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'পাসওয়ার্ড',
              style: TextStyle(fontSize: 16, fontFamily: 'BanglaFont'),
            ),
            const SizedBox(height: 8),
            TextField(
              obscureText: true,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                hintText: 'আপনার পাসওয়ার্ড লিখুন',
                hintStyle: const TextStyle(fontFamily: 'BanglaFont'),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'পাসওয়ার্ড নিশ্চিত করুন',
              style: TextStyle(fontSize: 16, fontFamily: 'BanglaFont'),
            ),
            const SizedBox(height: 8),
            TextField(
              obscureText: true,
              decoration: InputDecoration(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(6),
                ),
                hintText: 'পাসওয়ার্ড পুনরায় লিখুন',
                hintStyle: const TextStyle(fontFamily: 'BanglaFont'),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  // Handle sign-up logic here
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1f77b4),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                child: const Text(
                  'সাইন আপ করুন',
                  style: TextStyle(fontSize: 16, color: Colors.white, fontFamily: 'BanglaFont'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}