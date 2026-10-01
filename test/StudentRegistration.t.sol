// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/StudentRegistration.sol";

contract StudentRegistrationTest {
    function testRegisterAndGetStudent() public {
        StudentRegistration registration = new StudentRegistration();

        registration.register("Ada Lovelace", 36, "Computer Science");

        assert(registration.registered(address(this)));

        (string memory name, uint256 age, string memory course) = registration
            .getStudent(address(this));

        assert(keccak256(bytes(name)) == keccak256(bytes("Ada Lovelace")));
        assert(age == 36);
        assert(keccak256(bytes(course)) == keccak256(bytes("Computer Science")));
        assert(registration.studentCount() == 1);
        assert(registration.getStudentAddress(0) == address(this));
    }

    function testCannotRegisterTwice() public {
        StudentRegistration registration = new StudentRegistration();
        registration.register("Ada Lovelace", 36, "Computer Science");

        (bool success, ) = address(registration).call(
            abi.encodeWithSelector(
                registration.register.selector,
                "Grace Hopper",
                37,
                "Mathematics"
            )
        );

        assert(!success);
    }

    function testCannotGetUnregisteredStudent() public {
        StudentRegistration registration = new StudentRegistration();

        (bool success, ) = address(registration).call(
            abi.encodeWithSelector(registration.getStudent.selector, address(1))
        );

        assert(!success);
    }
}