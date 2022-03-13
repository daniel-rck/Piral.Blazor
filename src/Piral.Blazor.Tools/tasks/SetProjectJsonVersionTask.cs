﻿using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;
using System;
using System.IO;

namespace Piral.Blazor.Tools.Tasks
{
    public class SetProjectJsonVersionTask : Task
    {
        [Required]
        public string PackageJsonPath { get; set; }

        [Required]
        public string Version { get; set; }

        public override bool Execute()
        {
            Log.LogMessage("Set version in package.json file...");

            try
            {
                if (!File.Exists(PackageJsonPath))
                {
                    Log.LogError($"The file '{PackageJsonPath}' does not exist."); 
                    return false;
                }

                var packageJsonText = File.ReadAllText(PackageJsonPath)
                    .Replace(@"""version"": ""1.0.0""", $@"""version"": ""{Version}""");

                File.WriteAllText(PackageJsonPath, packageJsonText);
            }
            catch (Exception error)
            {
                Log.LogError(error.Message);  
                return false;
            }

            return true; 
        }
    }
}
