import setuptools

setuptools.setup(
    name="foods",
    packages=setuptools.find_packages(),
    version="0.0.1",
    author="Luke Logan",
    author_email="lukemartinlogan@gmail.com",
    description="Meal planning tool",
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url="https://github.com/lukemartinlogan/foods.git",
    classifiers = [
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Development Status :: 0 - Pre-Alpha",
        "Environment :: Other Environment",
        "Intended Audience :: Developers",
        "License :: None",
        "Operating System :: OS Independent",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Application Configuration",
    ],
    install_requires=[
        'pyyaml',
        'zipfile',
        'requests',
        'jarvis-util @ git+https://github.com/scs-lab/jarvis-util.git#egg=jarvis-util'
    ]
)