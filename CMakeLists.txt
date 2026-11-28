cmake_minimum_required(VERSION 3.15)

project(ALF_EWG LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

include_directories(${PROJECT_SOURCE_DIR}/include)

add_library(ALF_EWG_core
    "${PROJECT_SOURCE_DIR}/src/core/EarlyWarningSiren.cpp"
    "${PROJECT_SOURCE_DIR}/src/core/IncidentLogger.cpp"
    "${PROJECT_SOURCE_DIR}/src/core/SensorStation.cpp"
    "${PROJECT_SOURCE_DIR}/src/core/Simulation.cpp"
    "${PROJECT_SOURCE_DIR}/src/ui/Dashboard.cpp"
)

add_executable(${PROJECT_NAME}
    "${PROJECT_SOURCE_DIR}/src/main.cpp"
)
target_link_libraries(${PROJECT_NAME} PRIVATE ALF_EWG_core)
set_target_properties(${PROJECT_NAME} PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${PROJECT_SOURCE_DIR}/build")

add_executable(${PROJECT_NAME}_tests
    "${PROJECT_SOURCE_DIR}/tests/main_test.cpp"
)
target_link_libraries(${PROJECT_NAME}_tests PRIVATE ALF_EWG_core)
set_target_properties(${PROJECT_NAME}_tests PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${PROJECT_SOURCE_DIR}/build")

add_executable(SENTRA_api
    "${PROJECT_SOURCE_DIR}/src/api/ServerMain.cpp"
)
target_link_libraries(SENTRA_api PRIVATE ALF_EWG_core)
if(WIN32)
    target_link_libraries(SENTRA_api PRIVATE ws2_32 wsock32)
else()
    find_package(Threads REQUIRED)
    target_link_libraries(SENTRA_api PRIVATE Threads::Threads)
endif()
set_target_properties(SENTRA_api PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${PROJECT_SOURCE_DIR}/build")

enable_testing()

set(ALF_EWG_TEST_SUITES
    HazardCalculations
    RiskClassifications
    FunctionOverloading
    DeepCopying
    OperatorOverloading
    StaticMembers
    VirtualInheritance
    RuntimePolymorphism
    Containership
    ExceptionHandling
    BinarySerialization
    SeekpSeekg
    Rollback
    EvacuationPrioritization
    SirenActivation
    InvalidTelemetryRejection
    DashboardIntegration
)

foreach(SUITE_NAME IN LISTS ALF_EWG_TEST_SUITES)
    add_test(NAME "${SUITE_NAME}" COMMAND ${PROJECT_NAME}_tests "${SUITE_NAME}")
endforeach()
