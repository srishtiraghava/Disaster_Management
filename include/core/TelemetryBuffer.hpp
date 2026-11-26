#pragma once

#include <cstddef>
#include <utility>
#include <stdexcept>

namespace DisasterCore {
namespace Core {

/**
 * TelemetryBuffer stores a dynamic array of raw sensor measurements.
 * It demonstrates manual memory management, deep copy, assignment,
 * and proper destruction.
 */
class TelemetryBuffer {
private:
    double* data_;      // dynamically allocated array
    std::size_t size_;  // number of valid elements
    std::size_t capacity_; // allocated capacity

    void checkIndex(std::size_t idx) const {
        if (idx >= size_) {
            throw std::out_of_range("TelemetryBuffer index out of range");
        }
    }
public:
    // Parameterized constructor: allocate given capacity (default size 0)
    explicit TelemetryBuffer(std::size_t capacity = 0)
        : data_(capacity ? new double[capacity] : nullptr),
          size_(0),
          capacity_(capacity) {}

    // Deep copy constructor
    TelemetryBuffer(const TelemetryBuffer& other)
        : data_(other.capacity_ ? new double[other.capacity_] : nullptr),
          size_(other.size_),
          capacity_(other.capacity_) {
        for (std::size_t i = 0; i < size_; ++i) {
            data_[i] = other.data_[i];
        }
    }

    // Move constructor
    TelemetryBuffer(TelemetryBuffer&& other) noexcept
        : data_(other.data_), size_(other.size_), capacity_(other.capacity_) {
        other.data_ = nullptr;
        other.size_ = 0;
        other.capacity_ = 0;
    }

    // Copy assignment (deep copy, self‑check)
    TelemetryBuffer& operator=(const TelemetryBuffer& other) {
        if (this != &other) {
            TelemetryBuffer temp(other); // copy‑construct
            swap(temp);
        }
        return *this;
    }

    // Move assignment
    TelemetryBuffer& operator=(TelemetryBuffer&& other) noexcept {
        if (this != &other) {
            delete[] data_; // free current
            data_ = other.data_;
            size_ = other.size_;
            capacity_ = other.capacity_;
            other.data_ = nullptr;
            other.size_ = 0;
            other.capacity_ = 0;
        }
        return *this;
    }

    // Destructor
    ~TelemetryBuffer() {
        delete[] data_; // safe even if nullptr
    }

    // Swap helper
    void swap(TelemetryBuffer& other) noexcept {
        using std::swap;
        swap(data_, other.data_);
        swap(size_, other.size_);
        swap(capacity_, other.capacity_);
    }

    // Append a measurement; grows if needed (simple reallocation strategy)
    void push_back(double value) {
        if (size_ == capacity_) {
            // grow capacity (double or at least 1)
            std::size_t newCap = capacity_ ? capacity_ * 2 : 1;
            double* newData = new double[newCap];
            for (std::size_t i = 0; i < size_; ++i) newData[i] = data_[i];
            delete[] data_;
            data_ = newData;
            capacity_ = newCap;
        }
        data_[size_++] = value;
    }

    // Access element (read/write)
    double& operator[](std::size_t idx) {
        checkIndex(idx);
        return data_[idx];
    }
    const double& operator[](std::size_t idx) const {
        checkIndex(idx);
        return data_[idx];
    }

    std::size_t size() const noexcept { return size_; }
    std::size_t capacity() const noexcept { return capacity_; }
};

} // namespace Core
} // namespace DisasterCore
