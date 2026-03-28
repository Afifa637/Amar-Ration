import 'package:flutter/material.dart';

class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({Key? key}) : super(key: key);

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  String _selectedFilter = 'Today'; // Today, Week, All
  String _searchQuery = '';
  late TextEditingController _searchController;

  // Mock data for scans
  final List<Map<String, dynamic>> allScans = [
    {
      'consumerName': 'রহিম আহমেদ',
      'phone': '01712345678',
      'status': 'সফল',
      'timestamp': '২৮ মার্চ, ১০:৩০ এএম',
      'date': DateTime.now(),
    },
    {
      'consumerName': 'ফাতিমা বেগম',
      'phone': '01987654321',
      'status': 'সফল',
      'timestamp': '२८ মার্চ, ১০:১৫ এএম',
      'date': DateTime.now(),
    },
    {
      'consumerName': 'করিম হাসান',
      'phone': '01654321098',
      'status': 'অযোগ্য',
      'timestamp': '२८ মার্চ, ०९:४५ এএম',
      'date': DateTime.now(),
    },
    {
      'consumerName': 'সালমা খাতুন',
      'phone': '01567890123',
      'status': 'সফল',
      'timestamp': '२८ মার্চ, ००:३०  এএম',
      'date': DateTime.now(),
    },
    {
      'consumerName': 'আবুল কাশেম',
      'phone': '01789012345',
      'status': 'সফল',
      'timestamp': '२८ মার্চ, ००:१५ এএম',
      'date': DateTime.now(),
    },
    {
      'consumerName': 'নাজমা আক্তার',
      'phone': '01234567890',
      'status': 'অযোগ্য',
      'timestamp': '२७ মার্চ, ०४:०० পিএম',
      'date': DateTime.now().subtract(const Duration(days: 1)),
    },
    {
      'consumerName': 'হাসিনা খাতুন',
      'phone': '01345678901',
      'status': 'সফল',
      'timestamp': '२७ मार्च, १०:३० ए एम',
      'date': DateTime.now().subtract(const Duration(days: 1)),
    },
    {
      'consumerName': 'রুহুল আমিন',
      'phone': '01456789012',
      'status': 'সফল',
      'timestamp': '२६ मार्च, ०३:००पीएम',
      'date': DateTime.now().subtract(const Duration(days: 2)),
    },
  ];

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _getFilteredScans() {
    List<Map<String, dynamic>> filtered = allScans;

    // Apply date filter
    if (_selectedFilter == 'Today') {
      final today = DateTime.now();
      filtered = filtered
          .where((scan) =>
              (scan['date'] as DateTime).day == today.day &&
              (scan['date'] as DateTime).month == today.month &&
              (scan['date'] as DateTime).year == today.year)
          .toList();
    } else if (_selectedFilter == 'Week') {
      final lastWeek = DateTime.now().subtract(const Duration(days: 7));
      filtered = filtered
          .where((scan) => (scan['date'] as DateTime).isAfter(lastWeek))
          .toList();
    }

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      filtered = filtered
          .where((scan) => (scan['consumerName'] as String)
              .toLowerCase()
              .contains(_searchQuery.toLowerCase()))
          .toList();
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filteredScans = _getFilteredScans();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'স্কেন ইতিহাস',
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
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
              decoration: InputDecoration(
                hintText: 'গ্রাহক নাম খুঁজুন',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF1f77b4)),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() {
                            _searchController.clear();
                            _searchQuery = '';
                          });
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ),

          // Filter Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildFilterButton('Today', 'আজ'),
                const SizedBox(width: 12),
                _buildFilterButton('Week', 'এই সপ্তাহ'),
                const SizedBox(width: 12),
                _buildFilterButton('All', 'সব'),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Scan History List
          Expanded(
            child: filteredScans.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.inbox, size: 60, color: Color(0xFFCCCCCC)),
                        SizedBox(height: 12),
                        Text(
                          'কোনো স্কেন রেকর্ড নেই',
                          style: TextStyle(
                            fontFamily: 'Anek Bangla',
                            fontSize: 16,
                            color: Color(0xFF999999),
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filteredScans.length,
                    itemBuilder: (context, index) {
                      final scan = filteredScans[index];
                      final isSuccess = scan['status'] == 'সফল';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(
                            color: isSuccess
                                ? const Color(0xFFE8F5E9)
                                : const Color(0xFFFFEBEE),
                            width: 1.5,
                          ),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Status Icon
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSuccess
                                    ? const Color(0xFFF0F8F0)
                                    : const Color(0xFFFFF0F0),
                              ),
                              child: Center(
                                child: Icon(
                                  isSuccess ? Icons.check_circle : Icons.cancel,
                                  color: isSuccess
                                      ? const Color(0xFF28a745)
                                      : const Color(0xFFdc3545),
                                  size: 24,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),

                            // Consumer Info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
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
                                    scan['phone'],
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 12,
                                      color: Color(0xFF999999),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    scan['timestamp'],
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 11,
                                      color: Color(0xFFCCCCCC),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Status Badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: isSuccess
                                    ? const Color(0xFFF0F8F0)
                                    : const Color(0xFFFFF0F0),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                scan['status'],
                                style: TextStyle(
                                  fontFamily: 'Anek Bangla',
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isSuccess
                                      ? const Color(0xFF28a745)
                                      : const Color(0xFFdc3545),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterButton(String value, String label) {
    final isSelected = _selectedFilter == value;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedFilter = value;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF1f77b4) : Colors.white,
            border: Border.all(
              color: isSelected ? const Color(0xFF1f77b4) : const Color(0xFFCCCCCC),
              width: 1,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : const Color(0xFF666666),
            ),
          ),
        ),
      ),
    );
  }
}
